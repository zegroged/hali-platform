import { NextRequest, NextResponse } from "next/server";

// WHATSAPP DURUM WEBHOOK'U (2026-07-29).
//
// NEDEN VAR: Cloud API'de gönderim isteği `accepted` dönse bile mesaj teslim
// EDİLMEYEBİLİR — Meta sebebi yalnız webhook ile bildirir, sorgulanabilir bir
// "durum" ucu YOKTUR. Bu uç açılana kadar sistem kördü: 29 Temmuz'da üç şablon
// `accepted` döndü, hiçbiri telefona ulaşmadı ve sebebini görmenin yolu yoktu.
//
// KURULUM (Meta App Dashboard → WhatsApp → Configuration → Webhook):
//   Callback URL : https://enyakinhaliyikamaservisi.com/api/whatsapp/webhook
//   Verify token : .env'deki WHATSAPP_WEBHOOK_TOKEN ile AYNI değer
//   Abone alanlar: "messages" (durum bildirimleri bu alandan gelir)
// Ardından WABA'ya uygulama aboneliği: POST /{waba-id}/subscribed_apps
//
// ⚠️ İMZA DOĞRULAMASI: Meta her isteğe X-Hub-Signature-256 koyar; doğrulamak
// için uygulama gizli anahtarı (app secret) gerekir ve prod .env'de YOKTUR.
// META_APP_SECRET eklenirse aşağıdaki kontrol kendiliğinden devreye girer.
// ⚠️ BU YORUM 2026-07-29'da GÜNCELLENDİ: uç artık YALNIZ LOG YAZMIYOR —
// gelen mesajları veritabanına yazıyor ve halıcıya bildirim gönderiyor.
// Dolayısıyla imzasız çalışmak eskisi kadar zararsız değil. Geçici savunma:
// gövdedeki WABA kimliği kontrolü (POST içinde). KALICI ÇÖZÜM: .env'e
// META_APP_SECRET eklenmeli — eklendiği an imza doğrulaması kendiliğinden
// devreye girer ve sahte istek tamamen imkânsızlaşır.

export const dynamic = "force-dynamic";

/** Meta'nın abonelik doğrulaması: hub.challenge'ı aynen geri döndür. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");
  const beklenen = process.env.WHATSAPP_WEBHOOK_TOKEN;

  if (!beklenen) {
    console.error("[whatsapp-webhook] WHATSAPP_WEBHOOK_TOKEN tanımsız");
    return new NextResponse("yapılandırma eksik", { status: 500 });
  }
  if (mode === "subscribe" && token === beklenen && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new NextResponse("doğrulanamadı", { status: 403 });
}

type Durum = {
  id?: string;
  status?: string;
  recipient_id?: string;
  timestamp?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
  conversation?: { id?: string; origin?: { type?: string } };
  pricing?: { billable?: boolean; category?: string };
};

/** Meta'nın gelen mesaj gövdesi (kullandığımız alanlar).
 *  ⚠️ `id` alanları (medya kimliği) 2026-08-07 akşam eklendi — onlar olmadan
 *  dosyanın kendisine ulaşmanın YOLU YOK. */
type Medya = { id?: string; mime_type?: string };
type Gelen = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { caption?: string } & Medya;
  video?: { caption?: string } & Medya;
  document?: { caption?: string; filename?: string } & Medya;
  sticker?: Medya;
  audio?: { voice?: boolean } & Medya;
  location?: { latitude?: number; longitude?: number; name?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
};

/** Mesajı panelde okunabilir tek satıra çevir. `body` zorunlu alan olduğu için
 *  metin olmayan mesajlarda (fotoğraf, konum, ses) ne geldiğini yazıyoruz —
 *  halıcı en azından "müşteri fotoğraf gönderdi" görüp WhatsApp'tan açabilsin. */
function mesajMetni(m: Gelen): string {
  const t = m.text?.body?.trim();
  if (t) return t;
  switch (m.type) {
    case "image":
      return m.image?.caption?.trim() || "[fotoğraf]";
    case "video":
      return m.video?.caption?.trim() || "[video]";
    case "document":
      return m.document?.caption?.trim() || `[belge: ${m.document?.filename ?? "dosya"}]`;
    case "audio":
      return m.audio?.voice ? "[sesli mesaj]" : "[ses dosyası]";
    case "sticker":
      return "[çıkartma]";
    case "location": {
      const k = m.location;
      const ad = k?.name?.trim();
      return `[konum${ad ? `: ${ad}` : ""}] ${k?.latitude ?? "?"},${k?.longitude ?? "?"}`;
    }
    case "contacts":
      return "[kişi kartı]";
    case "button":
      return m.button?.text?.trim() || "[buton yanıtı]";
    case "interactive":
      return (
        m.interactive?.button_reply?.title?.trim() ||
        m.interactive?.list_reply?.title?.trim() ||
        "[seçim yanıtı]"
      );
    default:
      return `[${m.type ?? "bilinmeyen mesaj"}]`;
  }
}

/** Mesajın medya kimliği (varsa). Fotoğraf/ses/video/belge/çıkartma. */
function medyaKimligi(m: Gelen): string | null {
  return (
    m.image?.id ?? m.video?.id ?? m.audio?.id ?? m.document?.id ?? m.sticker?.id ?? null
  );
}

/**
 * MEDYAYI ARKA PLANDA İNDİR VE SATIRA İŞLE (2026-08-07 akşam).
 *
 * ⚠️ `await` EDİLMEZ, bilerek: Meta bu uçtan HIZLI 200 bekler, gecikirse aynı
 * olayı tekrar tekrar gönderir. Mesajın metin satırı zaten yazılmış oldu;
 * dosya birkaç saniye içinde satıra eklenir, panel bir sonraki açılışta gösterir.
 * İndirme başarısız olursa satır olduğu gibi kalır — mesaj kaybolmaz.
 */
async function medyayiIsle(waId: string, mediaId: string): Promise<void> {
  const { waMedyayiIndir } = await import("@/lib/whatsappMedya");
  const { prisma } = await import("@/lib/prisma");
  const medya = await waMedyayiIndir(mediaId);
  if (!medya) return;
  await prisma.whatsAppMessage.updateMany({
    where: { waId },
    data: { mediaUrl: medya.url, mediaType: medya.tur },
  });
  console.log(`[whatsapp-webhook] medya kaydedildi waId=${waId} tur=${medya.tur}`);
}

/** GELEN MESAJI KAYDET + İŞLETMEYE EŞLE + SAHİBİNE ZİL ÇAL (2026-07-29).
 *
 *  NEDEN VAR: müşterinin WhatsApp'tan yazdığı her şey bugüne kadar YALNIZ
 *  konteyner log'una düşüyordu — kimse göremiyor, kimse cevaplayamıyordu.
 *
 *  ÇİFT KAYIT: Meta 200 almazsa aynı olayı tekrar tekrar gönderir. `waId`
 *  benzersiz; yazımı `createMany + skipDuplicates` ile yapıyoruz, hem satır
 *  ikilenmiyor hem de (count===0) tekrar gelen olayda ZİL İKİNCİ KEZ ÇALMIYOR.
 *
 *  Tamamen best-effort: burada ne olursa olsun POST 200 döner. */
async function gelenMesajiKaydet(m: Gelen, ad: string | null): Promise<void> {
  if (!m.id || !m.from) return;
  const { prisma } = await import("@/lib/prisma");
  const { notify } = await import("@/lib/notify");
  const { waTelefonAdaylari } = await import("@/lib/whatsapp");

  // Hızlı yol: tekrar gelen olayda sipariş sorgusunu hiç çalıştırma.
  const zatenVar = await prisma.whatsAppMessage.findUnique({
    where: { waId: m.id },
    select: { id: true },
  });
  if (zatenVar) return;

  // EŞLEŞTİRME + KAÇIRMA (hijack) SAVUNMASI — 2026-07-29 denetim, KRİTİK.
  //
  // SALDIRI: mesaj "numaranın EN SON siparişi hangi işletmedeyse oraya" diye
  // yönlendiriliyordu. Ama sipariş kaydını HALICI kendisi açabiliyor
  // (panel → Yeni Kayıt, customerPhone serbest metin). Kötü niyetli bir halıcı,
  // rakibinin müşterisinin numarasıyla sahte kayıt açıp o müşterinin bundan
  // sonraki WhatsApp mesajlarını KENDİ paneline düşürebilir ve cevap ucundaki
  // izolasyon kapısı da (o numarayla yazışması var mı?) böylece kendiliğinden
  // açılırdı. Yani tek hamleyle hem okuma hem yazma yetkisi ele geçiyordu.
  //
  // SAVUNMA (üç katman):
  // 1. ZAMAN SINIRI: yalnız son 30 günün siparişi eşleşme kurar. Eski bir
  //    ilişki, yıllar sonra gelen bir mesajı sahiplenemez.
  // 2. İPTAL/RED HARİÇ: kapanmış işe bağlanmaz.
  // 3. YÖNLENDİRME DEĞİŞİMİ SESSİZ OLMAZ: bu numara daha önce BAŞKA bir
  //    işletmeye bağlandıysa mesaj SAHİPSİZ bırakılır (admin görür) ve log'a
  //    düşer. Meşru durumda (müşteri gerçekten halıcı değiştirdi) admin elle
  //    devreder; saldırı durumunda ise sessizce el değiştirmez.
  const adaylar = waTelefonAdaylari(m.from);
  const OTUZ_GUN = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const aday = adaylar.length
    ? await prisma.order.findFirst({
        where: {
          customerPhone: { in: adaylar },
          createdAt: { gte: OTUZ_GUN },
          status: { notIn: ["CANCELED", "REJECTED"] },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          businessId: true,
          business: { select: { ownerId: true } },
        },
      })
    : null;

  // Bu numara daha önce hangi işletmeye bağlanmıştı?
  const onceki = aday
    ? await prisma.whatsAppMessage.findFirst({
        where: { phone: m.from, businessId: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { businessId: true },
      })
    : null;
  const elDegistirdi =
    onceki?.businessId != null && onceki.businessId !== aday?.businessId;
  if (elDegistirdi) {
    console.error(
      `[whatsapp-webhook] YÖNLENDİRME DEĞİŞİMİ ENGELLENDİ gonderen=${m.from} onceki=${onceki?.businessId} yeni=${aday?.businessId} — mesaj sahipsiz bırakıldı (kaçırma şüphesi)`,
    );
  }
  const siparis = elDegistirdi ? null : aday;

  const yazilan = await prisma.whatsAppMessage.createMany({
    data: [
      {
        waId: m.id,
        direction: "IN",
        phone: m.from,
        name: ad,
        body: mesajMetni(m),
        businessId: siparis?.businessId ?? null,
        orderId: siparis?.id ?? null,
      },
    ],
    skipDuplicates: true,
  });
  if (yazilan.count === 0) return; // yarış: aynı olay eşzamanlı yazıldı

  // MEDYA: satır yazıldı, şimdi dosyanın kendisini getir (bkz. medyayiIsle).
  const mediaId = medyaKimligi(m);
  if (mediaId) {
    void medyayiIsle(m.id, mediaId).catch((e) =>
      console.error(`[whatsapp-webhook] medya işlenemedi waId=${m.id}:`, e),
    );
  }

  if (!siparis) {
    console.log(
      `[whatsapp-webhook] GELEN MESAJ EŞLEŞMEDİ gonderen=${m.from} — hiçbir siparişin müşteri numarasıyla tutmuyor, mesaj yalnız admin'de görünür`,
    );
    return;
  }
  if (siparis.business?.ownerId) {
    const onizleme = mesajMetni(m).slice(0, 140);
    await notify({
      userId: siparis.business.ownerId,
      type: "genel",
      title: "WhatsApp mesajı",
      body: `${ad?.trim() || m.from} yazdı${siparis.code ? ` (${siparis.code})` : ""}: ${onizleme}`,
      href: "/panel/mesajlar",
    });
  }
}

/** GİDEN mesajın durumu değişti — kaydı varsa `error` alanını güncelle.
 *  `updateMany` kullanıyoruz: o waId ile kayıt YOKSA sessizce 0 satır günceller
 *  (findUnique + update'e göre tek gidiş, kayıt yoksa hata da atmaz). */
async function durumuIsle(d: Durum): Promise<void> {
  if (!d.id) return;
  const { prisma } = await import("@/lib/prisma");
  if (d.status === "failed") {
    const h = d.errors?.[0];
    const sebep =
      h?.error_data?.details ?? h?.title ?? h?.message ?? "sebep bildirilmedi";
    await prisma.whatsAppMessage.updateMany({
      where: { waId: d.id },
      data: { error: h?.code ? `${sebep} (kod ${h.code})` : sebep },
    });
    return;
  }
  // Teslim edildiyse eski hata kaydı ARTIK YANLIŞ — temizle. Yalnız
  // delivered/read için yapıyoruz: bunlar mesajın gerçekten ulaştığını
  // söyler. `sent` bunu söylemez ve `failed`'dan SONRA sırasız gelirse
  // gerçek hatayı silerdi.
  if (d.status === "delivered" || d.status === "read") {
    await prisma.whatsAppMessage.updateMany({
      where: { waId: d.id, error: { not: null } },
      data: { error: null },
    });
  }
}

async function imzaGecerliMi(req: NextRequest, ham: string): Promise<boolean> {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true; // anahtar yoksa doğrulama atlanır (yukarıdaki nota bak)
  const imza = req.headers.get("x-hub-signature-256");
  if (!imza?.startsWith("sha256=")) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const beklenen = "sha256=" + createHmac("sha256", secret).update(ham).digest("hex");
  const a = Buffer.from(imza);
  const b = Buffer.from(beklenen);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Teslim edilemeyen mesajı sipariş geçmişine yaz + halıcıya zil çal.
 *  İz `lib/whatsapp.ts` içinde AppState'e `wa-msg-<id>` anahtarıyla bırakılır. */
async function mesajDustu(
  id: string | undefined,
  hata: { code?: number; title?: string; error_data?: { details?: string } } | undefined,
): Promise<void> {
  if (!id) return;
  const { prisma } = await import("@/lib/prisma");
  const { notify } = await import("@/lib/notify");
  const kayit = await prisma.appState.findUnique({ where: { key: `wa-msg-${id}` } });
  if (!kayit) return; // bizim gönderdiğimiz bir sipariş mesajı değil
  let iz: { orderId?: string; status?: string; etiket?: string; ownerUserId?: string | null };
  try {
    iz = JSON.parse(kayit.value);
  } catch {
    return;
  }
  if (!iz.orderId || !iz.status) return;
  const sebep = hata?.error_data?.details ?? hata?.title ?? "sebep bildirilmedi";
  await prisma.orderEvent.create({
    data: {
      orderId: iz.orderId,
      status: iz.status as never,
      note: `⚠️ ${iz.etiket ?? "WhatsApp mesajı"} MÜŞTERİYE ULAŞMADI (${sebep}) — müşteriyi telefonla bilgilendir`,
    },
  });
  if (iz.ownerUserId) {
    await notify({
      userId: iz.ownerUserId,
      type: "genel",
      title: "WhatsApp mesajı müşteriye ulaşmadı",
      body: `${iz.etiket ?? "Bildirim"} teslim edilemedi (${sebep}). Müşteriyi telefonla bilgilendirmen gerekebilir.`,
      href: `/panel/siparisler/${iz.orderId}`,
    });
  }
  // İz tek kullanımlık; birikmesin.
  await prisma.appState.delete({ where: { key: `wa-msg-${id}` } }).catch(() => {});
}

export async function POST(req: NextRequest) {
  // Meta 200 ALMAZSA aynı olayı defalarca tekrar gönderir; bu yüzden hata
  // hâlinde bile 200 dönüyoruz, sorunu log'a yazıyoruz.
  const ham = await req.text();
  if (!(await imzaGecerliMi(req, ham))) {
    console.error("[whatsapp-webhook] imza doğrulanamadı — istek yok sayıldı");
    return NextResponse.json({ ok: true });
  }
  // İKİNCİ KAPI — İMZA YOKKEN TEK SAVUNMA (2026-07-29 denetim, KRİTİK).
  // Bu uç artık yalnız log yazmıyor: VERİTABANINA YAZIYOR ve halıcıya bildirim
  // gönderiyor. META_APP_SECRET prod'da tanımlı olmadığı için imza kontrolü
  // atlanıyor; yani adresi bilen biri sahte "müşteri mesajı" uydurabilirdi.
  // Gövdedeki WABA kimliği bizimkiyle tutmuyorsa isteği YOK SAYIYORUZ.
  // Bu tam bir kimlik doğrulaması DEĞİLDİR (WABA kimliği gizli değil) —
  // asıl çözüm META_APP_SECRET'in .env'e eklenmesidir; o eklendiği an
  // imzaGecerliMi() gerçekten çalışır ve bu kapı yedeğe düşer.
  const bizimWaba = process.env.WHATSAPP_WABA_ID;
  if (bizimWaba && !ham.includes(bizimWaba)) {
    console.error(
      "[whatsapp-webhook] gövdede bizim WABA kimliğimiz yok — istek yok sayıldı",
    );
    return NextResponse.json({ ok: true });
  }

  try {
    const govde = JSON.parse(ham) as {
      entry?: {
        changes?: {
          value?: {
            statuses?: Durum[];
            messages?: Gelen[];
            contacts?: { profile?: { name?: string }; wa_id?: string }[];
          };
        }[];
      }[];
    };
    for (const e of govde.entry ?? []) {
      for (const c of e.changes ?? []) {
        // GELEN MESAJ (2026-07-29): teslim edilemeyen şablonların sebebini
        // ayırmak için eklendi. Numaradan BİZE mesaj düşüyorsa o numaranın
        // WhatsApp'ı sağlamdır ve sorun şablon/gönderim tarafındadır.
        for (const m of c.value?.messages ?? []) {
          // Profil adını GÖNDERENE göre bul (tek olayda birden çok kişi
          // olabilir); bulunamazsa eski davranış: listedeki ilk kişi.
          const kisi =
            c.value?.contacts?.find((k) => k.wa_id === m.from) ?? c.value?.contacts?.[0];
          const ad = kisi?.profile?.name ?? null;
          console.log(
            `[whatsapp-webhook] GELEN MESAJ gonderen=${m.from} ad="${ad ?? "-"}" tur=${m.type} metin="${m.text?.body ?? ""}"`,
          );
          // GELEN KUTUSU (2026-07-29): log'a yazmak yetmiyordu — kaydet, işletmeye
          // eşle, sahibine zil çal. Hata akışı bozmasın; Meta 200 ALMALI.
          try {
            await gelenMesajiKaydet(m, ad);
          } catch (e) {
            console.error(
              `[whatsapp-webhook] gelen mesaj kaydedilemedi id=${m.id} gonderen=${m.from}:`,
              e,
            );
          }
        }
        for (const d of c.value?.statuses ?? []) {
          const temel = `id=${d.id} alici=${d.recipient_id} durum=${d.status}`;
          // GELEN KUTUSU KAYDI (2026-07-29): giden mesajın satırı varsa hata
          // sebebini oraya da yaz — halıcı mesajı gönderdiği ekranda görsün.
          try {
            await durumuIsle(d);
          } catch (e) {
            console.error(`[whatsapp-webhook] durum kaydı güncellenemedi ${temel}:`, e);
          }
          if (d.status === "failed") {
            // ARADIĞIMIZ SATIR BU: teslim edilemeyen mesajın GERÇEK sebebi.
            const h = d.errors?.[0];
            console.error(
              `[whatsapp-webhook] BAŞARISIZ ${temel} kod=${h?.code} baslik="${h?.title}" ayrinti="${h?.error_data?.details ?? h?.message ?? ""}"`,
            );
            // KAYDI DÜZELT: gönderim anında "gönderildi" yazılmıştı; teslim
            // edilmediyse halıcı bunu panelde GÖRMELİ, yoksa müşterinin haberi
            // olduğunu sanıp arayıp bilgilendirmiyor.
            try {
              await mesajDustu(d.id, h);
            } catch (e) {
              // Kendi try'ı OLMALI: fırlatırsa dış catch yakalıyor, "gövde
              // ayrıştırılamadı" diye YANLIŞ teşhis yazıyor ve AYNI paketteki
              // sonraki GELEN mesajlar hiç işlenmeden düşüyordu (2026-07-29).
              console.error("[whatsapp-webhook] mesajDustu hatası:", e);
            }
          } else {
            console.log(
              `[whatsapp-webhook] ${temel} kategori=${d.pricing?.category ?? "-"} faturalanabilir=${d.pricing?.billable ?? "-"}`,
            );
          }
        }
      }
    }
  } catch (e) {
    console.error("[whatsapp-webhook] gövde ayrıştırılamadı:", e);
  }
  return NextResponse.json({ ok: true });
}
