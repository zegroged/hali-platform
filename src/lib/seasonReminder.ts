import { prisma } from "@/lib/prisma";
import { sendEmail, wrapEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/htmlSafe";
import { normalizePhone, isMobilePhone } from "@/lib/phone";
import { getAppBaseUrl } from "@/lib/config";
import { sendTemplate, whatsappEnabled } from "@/lib/whatsapp";

// SEZON HATIRLATMASI (2026-07-30, işletme sahibinin İKİ kararıyla YENİDEN yazıldı).
//
// NEDEN OTOMATİK: halı yıkatmak yılda bir-iki kez hatırlanan bir iştir; müşteri
// unutunca iş geri gelmiyor. "Halıcı kendi arasın" denendiğinde YAPILMIYOR.
//
// KARAR 1 — YALNIZ ADMİN YÖNETİR: ayar .env bayrağı DEĞİL, VERİTABANINDA
// (AppState "sezon-ayarlar"). Admin /admin/hatirlatma ekranından açar/kapar,
// aralığı değiştirir, elle tetikler — deploy gerekmez. Halıcı paneli bu işe
// HİÇ dokunmaz (o sayfa silindi). Gerekçe: "halıcılara bırakırsak yapılmaz."
//
// KARAR 2 — KANAL WHATSAPP, E-POSTA YEDEK: "e-postayı 60 yaşındaki teyze
// açmıyor". Şablon `sezon_hatirlatma` (MARKETING, URL butonu → işletme sayfası).
// Şablon Meta onayından geçene kadar gönderim kendiliğinden e-postaya düşer.
//
// HUKUK: ticari ileti (6563 + İYS). İşletme sahibi avukat/İYS tarafını
// HALLETTİĞİNİ söyledi (2026-07-30) — açma kararı yine de admin ekranında,
// koddan otomatik AÇILMAZ.

const VARSAYILAN_AY = 6;
const AYAR_KEY = "sezon-ayarlar";
const SON_CALISMA_KEY = "sezon-son-calisma";

/** Tek turda en fazla kaç müşteriye yazılır (kanalları boğmamak için). */
const TUR_LIMITI = 100;
/** Tek turda taranacak aday sipariş sayısı. */
const TARAMA_LIMITI = 800;

export type SezonAyar = { acik: boolean; ay: number };
export type SonCalisma = {
  at: string; // ISO
  gonderilen: number;
  kanal: { whatsapp: number; eposta: number };
  atlanan: number;
  elle: boolean;
};

/** Ayarlar VERİTABANINDAN okunur (admin panelden değiştirir, deploy gerekmez). */
export async function getSezonAyar(): Promise<SezonAyar> {
  try {
    const s = await prisma.appState.findUnique({ where: { key: AYAR_KEY } });
    if (!s) return { acik: false, ay: VARSAYILAN_AY };
    const v = JSON.parse(s.value) as Partial<SezonAyar>;
    const ay = Number(v.ay);
    return {
      acik: v.acik === true,
      ay: Number.isFinite(ay) && ay >= 1 && ay <= 24 ? Math.floor(ay) : VARSAYILAN_AY,
    };
  } catch {
    // Okunamıyorsa GÜVENLİ taraf: kapalı say (ticari ileti yanlışlıkla gitmesin).
    return { acik: false, ay: VARSAYILAN_AY };
  }
}

export async function setSezonAyar(v: SezonAyar): Promise<void> {
  const value = JSON.stringify({ acik: v.acik === true, ay: v.ay });
  await prisma.appState.upsert({
    where: { key: AYAR_KEY },
    create: { key: AYAR_KEY, value },
    update: { value },
  });
}

export async function getSonCalisma(): Promise<SonCalisma | null> {
  try {
    const s = await prisma.appState.findUnique({
      where: { key: SON_CALISMA_KEY },
    });
    return s ? (JSON.parse(s.value) as SonCalisma) : null;
  } catch {
    return null;
  }
}

/**
 * `d`den `n` ay öncesi. Gün taşması KIRPILIR: 31 Ağustos − 6 ay "3 Mart" değil
 * "28/29 Şubat" olmalı — JS'in setMonth'u taşırıp bir sonraki aya atıyor.
 */
export function aylarOnce(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const ay = d.getUTCMonth() - n;
  const sonGun = new Date(Date.UTC(y, ay + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      y,
      ay,
      Math.min(d.getUTCDate(), sonGun),
      d.getUTCHours(),
      d.getUTCMinutes(),
    ),
  );
}

/** Gruplamaya giren tek sipariş (saf tip — Prisma'ya bağlı değil). */
export type SezonKaydi = {
  orderId: string;
  phone: string;
  name: string;
  email: string | null;
  deliveredAt: Date;
  businessId: string;
  businessName: string;
  /** Mesajın adına gidebileceği işletme mi (görünür + demo değil)? */
  businessUygun: boolean;
};

/** Bir müşteri (telefon) için toparlanmış hatırlatma satırı. */
export type SezonSatiri = {
  phone: string; // normalize — gruplama anahtarı
  name: string;
  email: string | null;
  sonTeslim: Date;
  siparisSayisi: number;
  /**
   * Müşterinin GERÇEKTEN en son hizmet aldığı işletme — mesaj onun adıyla gider.
   * 🔴 İŞLETME SINIRI DERSİ (4.43 bulgusu): görünürlük süzgeci SORGUDA
   * uygulanırsa "en son" iddiası çarpılır — müşteri en son B'den aldıysa ama B
   * süzgece takıldıysa mesaj "en son A yıkamıştı" diye YALAN söylerdi. Süzgeç
   * artık gruplamadan SONRA: gerçek son işletme uygun değilse müşteri ATLANIR.
   */
  businessId: string;
  businessName: string;
  businessUygun: boolean;
  /** Bu numaranın gruba giren tüm siparişleri (birlikte işaretlenir). */
  orderIds: string[];
};

/** Telefona göre grupla. AYNI MÜŞTERİYE TEK MESAJ kuralının kalbi. */
export function telefonaGoreGrupla(kayitlar: SezonKaydi[]): SezonSatiri[] {
  const harita = new Map<string, SezonSatiri>();
  // Eskiden yeniye: son yazan (en yeni sipariş) kimliği belirler.
  const sirali = [...kayitlar].sort(
    (a, b) => a.deliveredAt.getTime() - b.deliveredAt.getTime(),
  );
  for (const k of sirali) {
    const anahtar = normalizePhone(k.phone);
    if (!anahtar) continue;
    const mevcut = harita.get(anahtar);
    if (!mevcut) {
      harita.set(anahtar, {
        phone: anahtar,
        name: k.name,
        email: k.email,
        sonTeslim: k.deliveredAt,
        siparisSayisi: 1,
        businessId: k.businessId,
        businessName: k.businessName,
        businessUygun: k.businessUygun,
        orderIds: [k.orderId],
      });
      continue;
    }
    mevcut.siparisSayisi += 1;
    mevcut.orderIds.push(k.orderId);
    mevcut.sonTeslim = k.deliveredAt;
    mevcut.name = k.name;
    mevcut.businessId = k.businessId;
    mevcut.businessName = k.businessName;
    mevcut.businessUygun = k.businessUygun;
    if (k.email) mevcut.email = k.email;
  }
  return [...harita.values()].sort(
    (a, b) => b.sonTeslim.getTime() - a.sonTeslim.getTime(),
  );
}

export type SezonOnizleme = {
  /** Gönderime girecek satırlar (uygun işletme + aktif olmayan müşteri). */
  satirlar: SezonSatiri[];
  /** İşletmesi uygun olmadığı için atlananlar (gizli/demo). */
  atlanan: number;
  /** Tarama penceresi doldu mu (dolduysa sayılar alt sınırdır). */
  pencereDoldu: boolean;
};

/**
 * Adayları tara + grupla + süz. GÖNDERMEZ, İŞARETLEMEZ — hem gerçek gönderim
 * hem /admin/hatirlatma önizlemesi AYNI fonksiyonu kullanır ki ekranda görünen
 * ile fiilen gönderilen asla ayrışmasın.
 */
export async function sezonOnizleme(ay: number): Promise<SezonOnizleme> {
  const esik = aylarOnce(new Date(), ay);

  // 🔴 İşletme süzgeci SORGUDA YOK (bkz. SezonSatiri.businessId notu) — yalnız
  // kanal önkoşulu var: WhatsApp kapalıysa e-postasız müşteriye ulaşamayız,
  // onları taramaya hiç sokmamak pencereyi korur.
  const adaylar = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      seasonRemindedAt: null,
      deliveredAt: { lte: esik },
      ...(whatsappEnabled
        ? {}
        : {
            OR: [
              { customerEmail: { not: null } },
              { customer: { email: { not: null } } },
            ],
          }),
    },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      deliveredAt: true,
      customer: { select: { email: true } },
      business: { select: { id: true, name: true, isDemo: true, isVisible: true } },
    },
    orderBy: { deliveredAt: "desc" },
    take: TARAMA_LIMITI,
  });
  if (adaylar.length === 0)
    return { satirlar: [], atlanan: 0, pencereDoldu: false };

  // AKTİF MÜŞTERİYİ RAHATSIZ ETME: eşikten SONRA teslimat almış YA DA şu an
  // SÜREN siparişi olan numaralara "uzun zamandır görüşmedik" denmez.
  // İkinci koşul denetim bulgusu (2026-07-30): yalnız DELIVERED'a bakılınca,
  // halısı O SIRADA yıkamada olan müşteriye "yeniden yıkatın" mesajı gidiyordu.
  // orderBy ŞART: sırasız take hangi 5000 satırın geleceğini garanti etmiyordu.
  const yakinlar = await prisma.order.findMany({
    where: {
      OR: [
        { status: "DELIVERED", deliveredAt: { gt: esik } },
        {
          status: {
            in: ["CREATED", "ACCEPTED", "PICKED_UP", "WASHING", "OUT_FOR_DELIVERY"],
          },
        },
      ],
    },
    select: { customerPhone: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const yakinSet = new Set(
    yakinlar.map((o) => normalizePhone(o.customerPhone)).filter(Boolean),
  );

  const gruplar = telefonaGoreGrupla(
    adaylar
      .filter((o) => o.deliveredAt != null)
      .map((o) => ({
        orderId: o.id,
        phone: o.customerPhone,
        name: o.customerName,
        email: o.customerEmail ?? o.customer?.email ?? null,
        deliveredAt: o.deliveredAt!,
        businessId: o.business.id,
        businessName: o.business.name,
        businessUygun: o.business.isVisible && !o.business.isDemo,
      })),
  ).filter((s) => !yakinSet.has(s.phone));

  const satirlar = gruplar.filter((s) => s.businessUygun);
  return {
    satirlar,
    atlanan: gruplar.length - satirlar.length,
    pencereDoldu: adaylar.length >= TARAMA_LIMITI,
  };
}

const gunTR = (d: Date) =>
  d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    // Konteynerde TZ yok (UTC): verilmezse gece yarısı teslimatları bir gün
    // geri görünür.
    timeZone: "Europe/Istanbul",
  });

/** E-posta gövdesi (WhatsApp gidemezse yedek kanal). */
function mesajHtml(s: SezonSatiri, ay: number, base: string): string {
  const isletme = escapeHtml(s.businessName);
  const url = `${base}/halici/${s.businessId}`;
  return wrapEmail(
    `<p style="margin:0 0 12px;">Merhaba ${escapeHtml(s.name)},</p>
     <p style="margin:0 0 12px;">Halılarınızı en son <strong>${gunTR(
       s.sonTeslim,
     )}</strong> tarihinde <strong>${isletme}</strong> yıkamıştı. Üzerinden ${ay} aydan fazla geçti — mevsim değişimi halıların bakım zamanıdır.</p>
     <p style="margin:0 0 16px;">Yeniden yıkatmak isterseniz aşağıdaki bağlantıdan aynı işletmeye sipariş verebilirsiniz; halınızı adresinizden alır, yıkar ve teslim ederler.</p>
     <p style="margin:0 0 16px;"><a href="${url}" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">${isletme} — sipariş ver</a></p>
     <p style="margin:0;color:#64748b;font-size:13px;">Bu hatırlatmayı almak istemiyorsanız bu e-postaya &quot;çıkar&quot; yazıp yanıtlamanız yeterlidir.</p>`,
  );
}

/** Normalize edilmiş 0XXXXXXXXXX numaranın DB'de bulunabilecek biçimleri —
 *  `Order.customerPhone` normalize EDİLMEDEN yazılıyor (bkz. whatsapp.ts
 *  waTelefonAdaylari ile aynı gerekçe). Telefon-bazlı claim bunlarla yapılır. */
function telefonBicimleri(normal: string): string[] {
  const on = normal.slice(1); // baştaki 0'sız
  return [normal, on, `90${on}`, `+90${on}`];
}

/**
 * SEZON HATIRLATMASI.
 *  - Günlük tik: yalnız admin AÇTIYSA çalışır (AppState).
 *  - `elle: true` (admin ekranındaki düğme): anahtar kapalıyken de çalışır —
 *    elle tetikleme zaten adminin açık iradesidir.
 * Kanal sırası: WhatsApp şablonu (onaylıysa + numara CEP ise) → e-posta.
 *
 * 🔴 YARIŞ GÜVENLİĞİ (2026-07-30 düşman denetimi — kritik bulgu): PendingButton
 * 10 sn'de sayfayı otomatik yenilediği için "elle tetik sürerken ikinci tetik"
 * bu projede GERÇEKÇİ bir senaryo; günlük tik de aynı ana denk gelebilir.
 * Üç katman:
 *  1. KOŞU KİLİDİ (AppState createMany — atomik): ikinci koşu hiç başlamaz.
 *  2. TELEFON-BAZLI CLAIM CAS: müşterinin eşikten eski TÜM teslimatları tek
 *     updateMany ile damgalanır; count=0 → başkası almış → GÖNDERME. Telefon
 *     bazlı olması 800'lük tarama penceresi kaymasını da çözer: pencere
 *     DIŞINDA kalan eski sipariş de işaretlenir, müşteri bir daha gruplanamaz
 *     (aksi halde pencere derinleştikçe aynı müşteriye daha eski siparişin
 *     işletme adıyla İKİNCİ mesaj gidiyordu).
 *  3. Geri alma yalnız KENDİ damgasıyla ve yalnız "Meta şablonu tanımadı"
 *     kesinliğinde: zaman aşımı gibi belirsiz durumlarda işaret KALIR —
 *     ticari ileti için at-most-once, at-least-once'tan iyidir (mükerrer
 *     pazarlama mesajı İYS şikâyeti doğurur; kaçan hatırlatma yalnız fırsattır).
 */
export async function sendSeasonReminders(opts?: { elle?: boolean }): Promise<{
  gonderilen: number;
  atlanan: number;
  ulasilamayan: number;
  kilitli?: boolean;
}> {
  const ayar = await getSezonAyar();
  if (!ayar.acik && !opts?.elle)
    return { gonderilen: 0, atlanan: 0, ulasilamayan: 0 };

  // 1) KOŞU KİLİDİ. 15 dk'dan eski kilit devralınır (ölmüş koşu).
  const KILIT = "sezon-kosu-kilidi";
  const damgaStr = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const kilitAl = await prisma.appState.createMany({
    data: [{ key: KILIT, value: damgaStr }],
    skipDuplicates: true,
  });
  if (kilitAl.count === 0) {
    const eski = await prisma.appState.findUnique({ where: { key: KILIT } });
    const yas = eski ? Date.now() - Number(eski.value.split(":")[0]) : Infinity;
    if (eski && yas < 15 * 60 * 1000) {
      return { gonderilen: 0, atlanan: 0, ulasilamayan: 0, kilitli: true };
    }
    // CAS devralma: eski değere eşitlik şartı — iki istek aynı anda devralamaz.
    const devral = await prisma.appState.updateMany({
      where: { key: KILIT, value: eski?.value ?? "" },
      data: { value: damgaStr },
    });
    if (devral.count === 0) {
      return { gonderilen: 0, atlanan: 0, ulasilamayan: 0, kilitli: true };
    }
  }

  try {
    const { satirlar, atlanan } = await sezonOnizleme(ayar.ay);
    const base = getAppBaseUrl();
    const esik = aylarOnce(new Date(), ayar.ay);
    let wa = 0;
    let ep = 0;
    let ulasilamayan = 0;

    for (const s of satirlar) {
      // Limit GÖNDERİLEN üzerinden — kanalsız müşteriler tepe-100'ü tıkayıp
      // arkadaki ulaşılabilir müşterileri aç bırakmasın (denetim bulgusu).
      if (wa + ep >= TUR_LIMITI) break;

      // Kanal önkoşulu — CLAIM'DEN ÖNCE: hiçbir kanala ulaşamayacaksak
      // müşteriyi işaretlemeyiz (kanal açılınca sırası gelir). WhatsApp yalnız
      // CEP numarasına denenir (waNumber sabit hattı da kabul ediyor — sabit
      // hatta şablon göndermek kotayı boşa yakar).
      const waOlur = whatsappEnabled && isMobilePhone(s.phone);
      if (!waOlur && !s.email) {
        ulasilamayan++;
        continue;
      }

      // 2) TELEFON-BAZLI CLAIM (CAS): count=0 → eşzamanlı koşu kazandı, atla.
      const damga = new Date();
      const claim = await prisma.order.updateMany({
        where: {
          customerPhone: { in: telefonBicimleri(s.phone) },
          status: "DELIVERED",
          deliveredAt: { lte: esik },
          seasonRemindedAt: null,
        },
        data: { seasonRemindedAt: damga },
      });
      if (claim.count === 0) continue;

      let gitti = false;
      let sablonYok = false;
      // 1) WhatsApp — MARKETING şablonu, buton işletme sayfasına gider.
      if (waOlur) {
        const r = await sendTemplate(
          s.phone,
          "sezon_hatirlatma",
          [s.name, s.businessName],
          { butonUrlParam: s.businessId },
        );
        if (r.ok) {
          wa++;
          gitti = true;
        } else {
          const e = (r.error ?? "").toLowerCase();
          // Yalnız "şablon yok/onaysız" KESİN gitmedi demektir; zaman aşımı
          // vb. belirsizdir — belirsizde işaret kalır (at-most-once).
          sablonYok =
            e.includes("template") || e.includes("132001") || e.includes("132000");
        }
      }
      // 2) E-posta yedek.
      if (!gitti && s.email) {
        try {
          await sendEmail(
            s.email,
            `${s.businessName} — halılarınızın bakım zamanı geldi`,
            `Halılarınızı en son ${gunTR(s.sonTeslim)} tarihinde ${s.businessName} yıkamıştı. Yeniden sipariş vermek için: ${base}/halici/${s.businessId}`,
            mesajHtml(s, ayar.ay, base),
          );
          ep++;
          gitti = true;
        } catch (e) {
          console.error("[sezon-hatirlatma] e-posta hatasi:", e);
        }
      }
      // 3) Geri alma: yalnız KENDİ damgamız + yalnız kesin-gitmedi durumu —
      //    böylece eşzamanlı koşunun BAŞARILI işaretini silemeyiz (denetim:
      //    koşulsuz geri alma üçüncü mesaja yol açıyordu). Şablon onaylanınca
      //    bu müşterilerin sırası kendiliğinden gelir.
      if (!gitti) {
        ulasilamayan++;
        if (sablonYok && !s.email) {
          await prisma.order.updateMany({
            where: {
              customerPhone: { in: telefonBicimleri(s.phone) },
              seasonRemindedAt: damga,
            },
            data: { seasonRemindedAt: null },
          });
        }
      }
    }

    const gonderilen = wa + ep;
    const kayit: SonCalisma = {
      at: new Date().toISOString(),
      gonderilen,
      kanal: { whatsapp: wa, eposta: ep },
      atlanan,
      elle: opts?.elle === true,
    };
    try {
      await prisma.appState.upsert({
        where: { key: SON_CALISMA_KEY },
        create: { key: SON_CALISMA_KEY, value: JSON.stringify(kayit) },
        update: { value: JSON.stringify(kayit) },
      });
    } catch {
      // kayıt düşmezse gönderim yine geçerli
    }
    if (gonderilen > 0 || ulasilamayan > 0)
      console.log(
        `[sezon-hatirlatma] gönderilen:${gonderilen} (wa:${wa} eposta:${ep}) ulaşılamayan:${ulasilamayan} — ${ayar.ay} ay eşiği, elle:${opts?.elle === true}`,
      );
    return { gonderilen, atlanan, ulasilamayan };
  } finally {
    // Kilidi yalnız KENDİ damgamızla bırak — devralınmış kilidi silmeyelim.
    await prisma.appState
      .deleteMany({ where: { key: KILIT, value: damgaStr } })
      .catch(() => {});
  }
}
