import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import type { OrderStatus } from "@prisma/client";

// WHATSAPP CLOUD API (2026-07-26) — sipariş bildirimlerinin ASIL kanalı.
// SMS pahalı olduğu için ertelenmişti; WhatsApp "utility" şablonu Türkiye'de
// mesaj başına ~3 kuruş. Mesajlar BİZİM numaramızdan gider, metinde işletme
// adı geçer ("Hijyen Halı Yıkama işletmesindeki halınız...").
//
// AÇILMA KOŞULU: WHATSAPP_TOKEN + WHATSAPP_PHONE_ID tanımlıysa çalışır; yoksa
// sessizce devre dışıdır (mevcut e-posta/zil kanalları etkilenmez).
// Meta kuralı: şablon dışı serbest metin ancak müşteri son 24 saatte bize
// yazdıysa gönderilebilir — o yüzden HER ŞEY onaylı şablonla gider.

const GRAPH = "https://graph.facebook.com/v21.0";

export const whatsappEnabled =
  Boolean(process.env.WHATSAPP_TOKEN) && Boolean(process.env.WHATSAPP_PHONE_ID);

/** TR numarasını Meta'nın beklediği biçime çevir (905321112233). */
export function waNumber(raw: string): string | null {
  const d = normalizePhone(raw); // 0XXXXXXXXXX
  if (!/^0[2-5]\d{9}$/.test(d)) return null;
  return "90" + d.slice(1);
}

/** Meta'nın verdiği numarayı (905xxxxxxxxx) veritabanında SAKLANIYOR OLABİLECEK
 *  bütün biçimlere çevirir — gelen mesajı siparişle eşleştirmek için.
 *
 *  NEDEN LİSTE: `Order.customerPhone` normalize EDİLMEDEN yazılıyor
 *  (api/orders ve api/panel/orders zod ile yalnız uzunluk bakıyor); sahadaki
 *  değer formların ürettiği "05xxxxxxxxx" biçimidir ama "5xxxxxxxxx",
 *  "905xxxxxxxxx", "+905xxxxxxxxx" de düşebilir. Hepsini deniyoruz.
 *
 *  TR DIŞI NUMARA → BOŞ LİSTE: yalnız son 10 haneye bakıp eşleşme kurmak
 *  yabancı bir numarayı alakasız bir siparişe bağlayabilirdi. Eşleşmemek
 *  (mesaj admin'de sahipsiz durur) YANLIŞ eşleşmekten iyidir. */
export function waTelefonAdaylari(waPhone: string): string[] {
  const d = (waPhone || "").replace(/\D/g, "");
  let son10 = "";
  if (/^90\d{10}$/.test(d)) son10 = d.slice(2); // Meta'nın normal biçimi
  else if (/^0\d{10}$/.test(d)) son10 = d.slice(1); // 0 ile gelmişse
  else if (/^\d{10}$/.test(d)) son10 = d; // ülke kodsuz
  // TR abone numarası 2-5 ile başlar (cep 5, sabit hat 2/3/4).
  if (!/^[2-5]\d{9}$/.test(son10)) return [];
  return [`0${son10}`, son10, `90${son10}`, `+90${son10}`];
}

type SonucKaydi = { ok: boolean; id?: string; error?: string };

// GÜNLÜK GÖNDERİM TAVANI (2026-07-26): Meta'da reklam hesabındaki gibi harcama
// limiti YOK — kart kullandıkça çekiliyor. Kod tarafında fren koyuyoruz: bir
// hata döngüsü (bozuk bekçi, tekrar eden iş) faturayı şişirmesin. Normal hacim
// sipariş başına ~3 mesaj olduğundan 2.000 mesaj/gün fazlasıyla yeterli;
// aşılırsa gönderim durur ve log'a düşer (sipariş akışı etkilenmez).
const GUNLUK_TAVAN = Number(process.env.WHATSAPP_DAILY_CAP ?? 2000);

/** Bugünün sayacını 1 artır; tavan aşıldıysa false döner (gönderme). */
async function kotaVarMi(): Promise<boolean> {
  const gun = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC yeter)
  const key = `wa-gonderim-${gun}`;
  // TEK atomik adım: yoksa 1 ile oluştur, varsa 1 artır ve yeni değeri döndür.
  // (Prisma upsert'te "artır" ifadesi yok; ham SQL yarış koşulunu da kapatır.)
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    INSERT INTO "AppState" ("key", "value", "updatedAt")
    VALUES (${key}, '1', now())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = (COALESCE("AppState"."value", '0')::int + 1)::text,
          "updatedAt" = now()
    RETURNING "value"`;
  const sayi = Number(rows[0]?.value ?? 0);
  if (sayi > GUNLUK_TAVAN) {
    console.error(
      `[whatsapp] GÜNLÜK TAVAN AŞILDI (${sayi}/${GUNLUK_TAVAN}) — gönderim durduruldu`,
    );
    return false;
  }
  return true;
}

/** Onaylı şablonu gönder. Best-effort: hata ASLA sipariş akışını bozmaz. */
export async function sendTemplate(
  to: string,
  template: string,
  params: string[],
  opts?: {
    /** Şablonun URL butonuna eklenecek dinamik son ek (takip token'ı). */
    butonUrlParam?: string;
  },
): Promise<SonucKaydi> {
  if (!whatsappEnabled) return { ok: false, error: "whatsapp kapalı" };
  const num = waNumber(to);
  if (!num) return { ok: false, error: "geçersiz numara" };
  if (!(await kotaVarMi()))
    return { ok: false, error: "günlük gönderim tavanı aşıldı" };

  try {
    const components: unknown[] = params.length
      ? [
          {
            type: "body",
            parameters: params.map((p) => ({ type: "text", text: p })),
          },
        ]
      : [];
    // Dinamik URL butonu: şablonda `.../takip/{{1}}` tanımlı, son ek buradan.
    if (opts?.butonUrlParam) {
      components.push({
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: opts.butonUrlParam }],
      });
    }
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: num,
        type: "template",
        template: {
          name: template,
          language: { code: "tr" },
          components,
        },
      }),
      // Ağ takılırsa sipariş akışı beklemesin.
      signal: AbortSignal.timeout(12000),
    });
    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };
    if (!res.ok || data.error) {
      return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "bilinmeyen hata" };
  }
}

/** LİNKLİ ŞABLONU DENE, OLMAZSA ESKİSİNE DÜŞ (2026-07-30).
 *
 *  Kullanıcı kararı: müşteriye giden her bildirimde TIKLANABİLİR takip linki
 *  olmalı — 24 saatlik pencere bir haftalık yıkama süresinde çoktan kapandığı
 *  için bu ancak URL butonlu şablonla olur. Butonlu `_link` şablonları Meta
 *  incelemesinde (PENDING); onaylanana kadar gönderim "şablon bulunamadı /
 *  onaysız" hatası verir. Bu sarmalayıcı sayesinde:
 *    - onay GELMEDEN: eski onaylı şablon çalışmaya devam eder (kesinti yok),
 *    - onay GELİNCE: ek deploy olmadan kendiliğinden linkli şablona geçilir.
 *  Başarısız ilk deneme kota sayacını 1 harcar — onay bekleme penceresiyle
 *  sınırlı, kabul edilir maliyet. */
async function sendTemplateLinkli(
  to: string,
  linkliSablon: string,
  linkliParams: string[], // yeni şablonlar 2 değişkenli: [ad, işletme]
  eskiSablon: string,
  eskiParams: string[], // eskiler 3 değişkenli: [ad, işletme, kod]
  trackingToken: string,
): Promise<SonucKaydi> {
  const r = await sendTemplate(to, linkliSablon, linkliParams, {
    butonUrlParam: trackingToken,
  });
  if (r.ok) return r;
  // Yalnız "şablon yok/onaysız" hatasında düş; kota/numara hatasında düşme —
  // aynı hatayı ikinci kez almak kotayı boşa harcar.
  const e = (r.error ?? "").toLowerCase();
  const sablonSorunu =
    e.includes("template") || e.includes("132001") || e.includes("132000");
  if (!sablonSorunu) return r;
  return sendTemplate(to, eskiSablon, eskiParams);
}

/** SERBEST METİN — YALNIZ 24 SAATLİK PENCERE İÇİNDE (2026-07-29).
 *  Şablondan farkı: metni biz yazarız. Meta bunu ancak müşteri son 24 saatte
 *  BİZE yazdıysa kabul eder; pencere kapalıysa 131047 döner. Pencereyi asıl
 *  kontrol eden çağırandır (panel cevap ucu son gelen mesaja bakar) — burada
 *  yine de 131047 Türkçeye çevrilir ki halıcı ekranda ham İngilizce görmesin.
 *  sendTemplate ile aynı desen: kapalıysa gönderme, kotayı harca, hata yut. */
export async function sendText(to: string, body: string): Promise<SonucKaydi> {
  if (!whatsappEnabled) return { ok: false, error: "whatsapp kapalı" };
  const num = waNumber(to);
  if (!num) return { ok: false, error: "geçersiz numara" };
  const metin = body.trim();
  if (!metin) return { ok: false, error: "boş mesaj" };
  if (!(await kotaVarMi()))
    return { ok: false, error: "günlük gönderim tavanı aşıldı" };

  try {
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: num,
        type: "text",
        // Meta'nın sınırı 4096; uç zaten 1000'de kesiyor, burada da güvence.
        text: { body: metin.slice(0, 1000) },
      }),
      signal: AbortSignal.timeout(12000),
    });
    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };
    if (!res.ok || data.error) {
      const kod = data.error?.code;
      if (kod === 131047)
        return {
          ok: false,
          error:
            "24 saatlik yanıt penceresi kapandı — serbest metin gönderilemez (Meta 131047).",
        };
      const msg = data.error?.message;
      return {
        ok: false,
        error: msg ? (kod ? `${msg} (kod ${kod})` : msg) : `HTTP ${res.status}`,
      };
    }
    return { ok: true, id: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "bilinmeyen hata" };
  }
}

/** GÖNDER + İŞLETMEYE BİLDİR (2026-07-26 kullanıcı isteği):
 *  - Başarılı: sipariş geçmişine "WhatsApp'tan gönderildi" satırı düşer
 *    (panelde sipariş detayında görünür; her mesaj için zil çalmak gürültü olurdu).
 *  - Başarısız: işletme sahibine ZİL — müşteriye ulaşılamadı, telefonla arasın.
 *  Tamamen best-effort: hiçbir hata sipariş akışını bozmaz. */
export async function waGonderVeKaydet(opts: {
  orderId: string;
  status: OrderStatus;
  ownerUserId?: string | null;
  etiket: string; // "Takip kodu", "Fiyat onayı", "Teslimat bilgisi"
  /** Sohbet ekranında görünecek okunur özet. Verilmezse `etiket` kullanılır. */
  metin?: string;
  /**
   * ŞABLONU META ONAYINDA OLAN BİLDİRİMLER İÇİN (2026-08-02).
   * Başarısızlıkta sipariş geçmişine "gönderilemedi" satırı YAZILMAZ ve
   * halıcıya zil ÇALMAZ — yalnız sunucu log'una düşer. Sebebi: yeni bir
   * şablon onaylanana kadar HER siparişte hata kaydı üretmek paneli
   * kirletir ve halıcıyı boşuna telaşlandırır. Şablon onaylandığı an
   * mesajlar kendiliğinden gitmeye başlar (ek deploy gerekmez).
   */
  sessizHata?: boolean;
  gonder: () => Promise<SonucKaydi>;
}): Promise<void> {
  if (!whatsappEnabled) return; // kapalıyken iz bırakma
  // DEMO PANEL MESAJ GÖNDERMEZ (2026-07-30): demo siparişlerin müşteri
  // numaraları uydurmadır (tahsissiz 0500 aralığı — WhatsApp'ta yoklar).
  // Gönderilseydi her satış gösterisi hem kotadan/paradan yerdi hem de
  // panelde "WhatsApp mesajı gitmedi" zili çalıp demoyu bozardı.
  //
  // TEK İSTİSNA (2026-08-04): komisyoncu demoyu karşısındaki halıcının GERÇEK
  // numarasına bağladıysa (lib/demoWa.ts, 24 saatlik süreli bağ) o numaraya
  // gönderim SERBEST — satışın en güçlü anı halıcının kendi telefonunda
  // mesajı görmesi. Bağ yalnız bağlanan numarayı açar; uydurma 0500
  // numaralarına gönderim yine kapalıdır.
  let siparis: {
    businessId: string;
    customerPhone: string;
    business: { isDemo: boolean };
  } | null = null;
  try {
    siparis = await prisma.order.findUnique({
      where: { id: opts.orderId },
      select: {
        businessId: true,
        customerPhone: true,
        business: { select: { isDemo: true } },
      },
    });
    if (siparis?.business.isDemo) {
      // Bağ sorgusu patlarsa KAPALI kabul et: demo panelinden yanlışlıkla
      // gerçek mesaj çıkmasındansa demo sessiz kalsın.
      let serbest = false;
      try {
        const { demoWaGecerliMi } = await import("@/lib/demoWa");
        serbest = await demoWaGecerliMi(siparis.businessId, siparis.customerPhone);
      } catch (e) {
        console.error("[whatsapp] demo bağı okunamadı:", e);
      }
      if (!serbest) return;
    }
  } catch {
    // Kontrol sorgusu patlarsa gerçek siparişin bildirimi durmasın.
  }
  const r = await opts.gonder();
  try {
    if (r.ok) {
      await prisma.orderEvent.create({
        data: {
          orderId: opts.orderId,
          status: opts.status,
          note: `${opts.etiket} müşteriye WhatsApp'tan gönderildi`,
        },
      });
      // TESLİMAT İZİ (2026-07-29): Meta'nın `accepted` yanıtı "aldım" demek,
      // "teslim ettim" DEMEZ — 29 Temmuz'da üç mesaj `accepted` döndü, hiçbiri
      // ulaşmadı (işletme doğrulaması engeli) ve panelde yine "gönderildi"
      // yazıyordu. Halıcı müşterinin haberi olduğunu sanıyordu. Gönderim
      // kimliğini saklıyoruz ki webhook `failed` bildirdiğinde kayıt
      // DÜZELTİLEBİLSİN (bkz. api/whatsapp/webhook).
      // SOHBETE DE YAZ (2026-07-30). Öncesinde giden bildirimler YALNIZ sipariş
      // geçmişine "gönderildi" satırı olarak düşüyordu; /panel/mesajlar ekranına
      // ise sadece (a) müşteriden GELEN ve (b) halıcının panelden yazdığı cevap
      // yazılıyordu. Sonuç: müşteri bildirime cevap verdiğinde halıcı neye cevap
      // verildiğini göremiyordu — konuşmanın yarısı eksikti.
      // `waId` benzersiz + createMany/skipDuplicates → tekrar denemede çift kayıt yok.
      // ⚠️ Bu kayıt YALNIZ sipariş bildirimleri için: OTP (`waOtp`) buradan
      // geçmez, doğrulama kodu halıcının gelen kutusuna DÜŞMEMELİ.
      if (r.id && siparis) {
        const num = waNumber(siparis.customerPhone);
        if (num) {
          await prisma.whatsAppMessage.createMany({
            data: [
              {
                waId: r.id,
                direction: "OUT",
                phone: num,
                body: opts.metin ?? opts.etiket,
                businessId: siparis.businessId,
                orderId: opts.orderId,
              },
            ],
            skipDuplicates: true,
          });
        }
      }
      if (r.id) {
        await prisma.appState.upsert({
          where: { key: `wa-msg-${r.id}` },
          create: {
            key: `wa-msg-${r.id}`,
            value: JSON.stringify({
              orderId: opts.orderId,
              status: opts.status,
              etiket: opts.etiket,
              ownerUserId: opts.ownerUserId ?? null,
            }),
          },
          update: { value: JSON.stringify({ orderId: opts.orderId, status: opts.status, etiket: opts.etiket, ownerUserId: opts.ownerUserId ?? null }) },
        });
      }
      return;
    }
    if (opts.sessizHata) {
      console.warn(
        `[whatsapp] sessiz hata (şablon onayı bekleniyor olabilir) — ${opts.etiket}: ${r.error ?? "bilinmeyen"}`,
      );
      return;
    }
    await prisma.orderEvent.create({
      data: {
        orderId: opts.orderId,
        status: opts.status,
        note: `WhatsApp gönderilemedi (${opts.etiket}): ${r.error ?? "bilinmeyen"}`,
      },
    });
    if (opts.ownerUserId) {
      await notify({
        userId: opts.ownerUserId,
        type: "genel",
        title: "WhatsApp mesajı gitmedi",
        body: `${opts.etiket} müşteriye ulaşmadı — telefonla bilgilendirmen gerekebilir.`,
        href: `/panel/siparisler/${opts.orderId}`,
      });
    }
  } catch (e) {
    console.error("whatsapp kayıt:", e);
  }
}

// ---- Sipariş olaylarına karşılık gelen yardımcılar ----
// Şablon adları Meta'da onaylıdır; değişken SIRASI şablonla birebir aynı olmalı.

/** Sipariş oluşturuldu: müşteri adı, işletme adı, takip kodu. */
// 2026-07-30 KULLANICI KARARI: her bildirimde TIKLANABİLİR takip linki.
// `token` = uzun trackingToken (kısa kod DEĞİL — approve-price kısa kodu 403'ler,
// bkz. 2026-07-14 taklit açığı). Linkli şablon onaylanana dek eskisine düşer.
export function waSiparisAlindi(
  to: string, ad: string, isletme: string, kod: string, token: string,
) {
  return sendTemplateLinkli(
    to, "siparis_alindi_link", [ad, isletme],
    "siparis_alindi", [ad, isletme, kod], token,
  );
}

/** Kesin fiyat girildi, müşteri onayı bekleniyor (tutar takip sayfasında). */
export function waFiyatOnayi(
  to: string, ad: string, isletme: string, kod: string, token: string,
) {
  return sendTemplateLinkli(
    to, "fiyat_onayi_link", [ad, isletme],
    "fiyat_onayi_bekleniyor", [ad, isletme, kod], token,
  );
}

// ---- ARA ADIM BİLDİRİMLERİ (2026-08-02 kullanıcı kararı) ----
// Öncesinde tipik akışta müşteriye YALNIZ 2 mesaj gidiyordu (yolda + teslim);
// "halımı aldılar mı, yıkanıyor mu" sorusu halıcıyı telefonda buluyordu.
// Bu iki şablonun ESKİ (linksiz) karşılığı YOKTUR → sendTemplateLinkli ile
// düşülecek yedek yok, doğrudan gönderilir. Onay gelene kadar başarısız olur;
// çağıran taraf `sessizHata: true` verdiği için panelde gürültü yapmaz.

/** Şoför halıyı teslim aldı (PICKED_UP). */
export function waHaliAlindi(to: string, ad: string, isletme: string, token: string) {
  return sendTemplate(to, "hali_alindi_link", [ad, isletme], {
    butonUrlParam: token,
  });
}

/** Yıkama başladı (WASHING). */
export function waYikamaBasladi(to: string, ad: string, isletme: string, token: string) {
  return sendTemplate(to, "yikama_basladi_link", [ad, isletme], {
    butonUrlParam: token,
  });
}

/** Yıkama bitti, teslime hazır. (Panel "hazır" düğmesi — notifyOrderReady.) */
export function waSiparisHazir(to: string, ad: string, isletme: string, kod: string) {
  return sendTemplate(to, "siparis_hazir", [ad, isletme, kod]);
}

/** Teslimata çıktı. */
export function waSiparisYolda(
  to: string, ad: string, isletme: string, kod: string, token: string,
) {
  return sendTemplateLinkli(
    to, "siparis_yolda_link", [ad, isletme],
    "siparis_yolda", [ad, isletme, kod], token,
  );
}

/** Teslim edildi + değerlendirme daveti (2026-07-28). */
export function waSiparisTeslim(
  to: string, ad: string, isletme: string, kod: string, token: string,
) {
  return sendTemplateLinkli(
    to, "siparis_teslim_link", [ad, isletme],
    "siparis_teslim_edildi", [ad, isletme, kod], token,
  );
}

/** Sipariş iptal/red edildi (2026-07-28). Sebep şablona GİRMEZ — Meta serbest
 *  metni kategori değişikliğine sokuyor; ayrıntı takip sayfasında ve e-postada. */
export function waSiparisIptal(
  to: string, ad: string, isletme: string, kod: string, token: string,
) {
  return sendTemplateLinkli(
    to, "siparis_iptal_link", [ad, isletme],
    "siparis_iptal", [ad, isletme, kod], token,
  );
}

/** TELEFON DOĞRULAMA KODU (2026-07-26): SMS pahalı olduğu için OTP de
 *  WhatsApp'tan gider. Meta'nın AUTHENTICATION şablonu özel biçimlidir: gövde
 *  metnini Meta üretir, biz yalnız KODU veririz; kod hem gövdede hem "Kodu
 *  kopyala" butonunda geçtiği için iki yerde de parametre olarak gönderilir.
 *  Türkiye tarifesi: kimlik doğrulama mesajı ~0,005 $ (~25 kuruş) — SMS'in
 *  yarısı. Şablon adı: dogrulama_kodu (kalıcı jetonla oluşturulacak). */
export async function waOtp(to: string, code: string): Promise<SonucKaydi> {
  if (!whatsappEnabled) return { ok: false, error: "whatsapp kapalı" };
  const num = waNumber(to);
  if (!num) return { ok: false, error: "geçersiz numara" };
  if (!(await kotaVarMi()))
    return { ok: false, error: "günlük gönderim tavanı aşıldı" };
  try {
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: num,
        type: "template",
        template: {
          name: "dogrulama_kodu",
          language: { code: "tr" },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: code }],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(12000),
    });
    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };
    if (!res.ok || data.error)
      return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, id: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "bilinmeyen hata" };
  }
}
