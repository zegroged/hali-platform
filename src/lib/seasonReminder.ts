import { prisma } from "@/lib/prisma";
import { sendEmail, wrapEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/htmlSafe";
import { normalizePhone } from "@/lib/phone";
import { getAppBaseUrl } from "@/lib/config";

// SEZON HATIRLATMASI (2026-07-30).
//
// NEDEN OTOMATİK: halı yıkatmak yılda bir-iki kez hatırlanan bir iştir; müşteri
// unutunca iş geri gelmiyor. "Halıcı kendi arasın" denendiğinde YAPILMIYOR —
// işletme sahibinin kararı bu yüzden "kesinlikle otomatik, 6 ayda bir gibi".
//
// 🔴 BAYRAK ARKASINDA: SEZON_HATIRLATMA=1 değilse iş HİÇ ÇALIŞMAZ — ne gönderim
// ne işaretleme. Sebep teknik değil HUKUKİ: bu bir TİCARİ İLETİDİR (6563 sayılı
// kanun + İYS kaydı + işletme sözleşmesinde onay maddesi). O taraf işletme
// sahibinde; kod hazır bekler, açma kararı onundur. Bayrak kapalıyken
// seasonRemindedAt'e hiçbir şey yazılmaz ki açıldığı gün geçmiş "gönderilmiş"
// gibi görünmesin.
//
// KANAL — E-POSTA: WhatsApp'ta bu mesajın şablonu YOK ve MARKETING kategorisine
// girer (Meta onayı zor, mesaj başına ücretli, opt-out zorunlu). Birinci sürüm
// bedava kanaldan gider; halıcı ayrıca /panel/hatirlatma listesinden kimin
// arandığını görür ve telefonla da dönebilir.

const VARSAYILAN_AY = 6;

/** 🔴 Ana bayrak — kapalıyken iş hiç çalışmaz (bkz. lib/phoneOtp.ts deseni). */
export const seasonReminderEnabled = process.env.SEZON_HATIRLATMA === "1";

/** Kaç ay sonra hatırlatılsın (env SEZON_AY, varsayılan 6). */
export const sezonAy = (() => {
  const v = Number(process.env.SEZON_AY);
  return Number.isFinite(v) && v >= 1 && v <= 60 ? Math.floor(v) : VARSAYILAN_AY;
})();

/** Tek turda en fazla kaç müşteriye yazılır (SMTP'yi boğmamak için). */
const TUR_LIMITI = 100;
/** Tek turda taranacak aday sipariş sayısı. */
const TARAMA_LIMITI = 800;

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

/** Hatırlatma eşiği: bu andan ÖNCE teslim edilenler "sezonu gelmiş" sayılır. */
export function sezonEsigi(simdi: Date = new Date()): Date {
  return aylarOnce(simdi, sezonAy);
}

/** Gruplamaya giren tek sipariş (saf tip — Prisma'ya bağlı değil). */
export type SezonKaydi = {
  orderId: string;
  phone: string;
  name: string;
  email: string | null;
  deliveredAt: Date;
  tutar: number;
  businessId: string;
  businessName: string;
  remindedAt: Date | null;
};

/** Bir müşteri (telefon) için toparlanmış hatırlatma satırı. */
export type SezonSatiri = {
  /** Normalize edilmiş numara — gruplama anahtarı. */
  phone: string;
  name: string;
  email: string | null;
  /** En son ne zaman hizmet aldı. */
  sonTeslim: Date;
  siparisSayisi: number;
  toplamTutar: number;
  /** En SON hizmeti veren işletme — mesaj onun adıyla gider. */
  businessId: string;
  businessName: string;
  /** Bu numaraya daha önce hatırlatma gittiyse tarihi. */
  remindedAt: Date | null;
  /** Bu numaranın gruba giren tüm siparişleri (hepsi birlikte işaretlenir). */
  orderIds: string[];
};

/**
 * Telefona göre grupla. AYNI MÜŞTERİYE TEK MESAJ kuralının kalbi burası:
 * numara normalize edilir ("+90555…", "0555…", "555…" hepsi aynı kişidir —
 * sipariş formuna nasıl yazıldığı müşteriden müşteriye değişiyor).
 *
 * Grubun kimliği (ad, e-posta, işletme) EN SON siparişten alınır: müşteri
 * en son kimden hizmet aldıysa onu hatırlar, mesaj o isimle gitmeli.
 */
export function telefonaGoreGrupla(kayitlar: SezonKaydi[]): SezonSatiri[] {
  const harita = new Map<string, SezonSatiri>();
  // Önce eskiden yeniye sırala; böylece son yazan (en yeni) kimliği belirler.
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
        toplamTutar: k.tutar,
        businessId: k.businessId,
        businessName: k.businessName,
        remindedAt: k.remindedAt,
        orderIds: [k.orderId],
      });
      continue;
    }
    mevcut.siparisSayisi += 1;
    mevcut.toplamTutar = Math.round((mevcut.toplamTutar + k.tutar) * 100) / 100;
    mevcut.orderIds.push(k.orderId);
    mevcut.sonTeslim = k.deliveredAt;
    mevcut.name = k.name;
    mevcut.businessId = k.businessId;
    mevcut.businessName = k.businessName;
    // E-posta: en yeni DOLU değer kazansın (son siparişte boş bırakılmışsa
    // eski siparişteki adres kaybolmasın).
    if (k.email) mevcut.email = k.email;
    // İşaretlerden en YENİSİ: "bu numaraya en son ne zaman yazdık".
    if (k.remindedAt && (!mevcut.remindedAt || k.remindedAt > mevcut.remindedAt))
      mevcut.remindedAt = k.remindedAt;
  }
  return [...harita.values()].sort(
    (a, b) => b.sonTeslim.getTime() - a.sonTeslim.getTime(),
  );
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

/** Hatırlatma e-postasının gövdesi — hizmeti veren işletmenin adıyla. */
function mesajHtml(s: SezonSatiri, base: string): string {
  const isletme = escapeHtml(s.businessName);
  const url = `${base}/halici/${s.businessId}`;
  return wrapEmail(
    `<p style="margin:0 0 12px;">Merhaba ${escapeHtml(s.name)},</p>
     <p style="margin:0 0 12px;">Halılarınızı en son <strong>${gunTR(
       s.sonTeslim,
     )}</strong> tarihinde <strong>${isletme}</strong> yıkamıştı. Üzerinden ${sezonAy} aydan fazla geçti — mevsim değişimi halıların bakım zamanıdır.</p>
     <p style="margin:0 0 16px;">Yeniden yıkatmak isterseniz aşağıdaki bağlantıdan aynı işletmeye sipariş verebilirsiniz; halınızı adresinizden alır, yıkar ve teslim ederler.</p>
     <p style="margin:0 0 16px;"><a href="${url}" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">${isletme} — sipariş ver</a></p>
     <p style="margin:0;color:#64748b;font-size:13px;">Bu hatırlatmayı almak istemiyorsanız bu e-postaya &quot;çıkar&quot; yazıp yanıtlamanız yeterlidir.</p>`,
  );
}

/**
 * SEZON HATIRLATMASI — günde bir çalışır (instrumentation günlük tik).
 *
 * Kimi bulur: N aydan önce teslim edilmiş, hatırlatılmamış ve e-posta adresi
 * olan siparişler. Numara bazında gruplanır → AYNI MÜŞTERİYE TEK MESAJ,
 * o numaranın gruba giren tüm siparişleri birlikte işaretlenir.
 *
 * Best-effort: hata saatlik/günlük tiki bozmamalı (çağıran yakalar).
 */
export async function sendSeasonReminders(): Promise<void> {
  // 🔴 BAYRAK — kapalıyken tek satır veri bile okunmaz/yazılmaz.
  if (!seasonReminderEnabled) return;

  const simdi = new Date();
  const esik = sezonEsigi(simdi);

  const adaylar = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      seasonRemindedAt: null,
      deliveredAt: { lte: esik },
      // E-POSTASI OLMAYAN ADAY DEĞİL: kanal e-posta olduğu için gönderilemez.
      // Sorgudan dışlanmazsa her gün tarama penceresini boşuna doldururlar
      // (halıcı onları /panel/hatirlatma listesinde görüp telefonla arar).
      OR: [
        { customerEmail: { not: null } },
        { customer: { email: { not: null } } },
      ],
      business: {
        // Demo işletme GERÇEK müşteriye yazmaz.
        isDemo: false,
        // Yayında olmayan işletmeye müşteri yönlendirmek kötü deneyim:
        // tıklayınca sipariş veremeyeceği bir sayfaya düşer.
        isVisible: true,
      },
    },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      deliveredAt: true,
      priceTotal: true,
      seasonRemindedAt: true,
      customer: { select: { email: true } },
      business: { select: { id: true, name: true } },
    },
    orderBy: { deliveredAt: "desc" },
    take: TARAMA_LIMITI,
  });
  if (adaylar.length === 0) return;

  // AKTİF MÜŞTERİYİ RAHATSIZ ETME: 8 ay önceki siparişi eşiği geçse de aynı
  // numaradan geçen ay yeni teslimat varsa "uzun zamandır görüşmedik" demek
  // yanlış olur (ve müşteriyi kaçırır). Yakın dönemde hizmet alan numaralar
  // elenir. Numara biçimleri veritabanında tek tip DEĞİL, bu yüzden eşleşme
  // SQL'de değil normalize edilmiş küme üzerinde yapılır.
  const yakinlar = await prisma.order.findMany({
    where: { status: "DELIVERED", deliveredAt: { gt: esik } },
    select: { customerPhone: true },
    take: 5000,
  });
  const yakinSet = new Set(
    yakinlar.map((o) => normalizePhone(o.customerPhone)).filter(Boolean),
  );

  const satirlar = telefonaGoreGrupla(
    adaylar
      .filter((o) => o.deliveredAt != null)
      .map((o) => ({
        orderId: o.id,
        phone: o.customerPhone,
        name: o.customerName,
        email: o.customerEmail ?? o.customer?.email ?? null,
        deliveredAt: o.deliveredAt!,
        tutar: Number(o.priceTotal ?? 0),
        businessId: o.business.id,
        businessName: o.business.name,
        remindedAt: o.seasonRemindedAt,
      })),
  ).filter((s) => !yakinSet.has(s.phone) && s.email);

  const base = getAppBaseUrl();
  let gonderilen = 0;
  for (const s of satirlar.slice(0, TUR_LIMITI)) {
    // ÖNCE İŞARETLE: SMTP yavaş/hatalıysa bir sonraki tur aynı kişiye ikinci
    // kez yazmasın (orderSla'daki aynı karar — mükerrer mesaj güven yakar).
    await prisma.order.updateMany({
      where: { id: { in: s.orderIds }, seasonRemindedAt: null },
      data: { seasonRemindedAt: new Date() },
    });
    try {
      await sendEmail(
        s.email!,
        `${s.businessName} — halılarınızın bakım zamanı geldi`,
        `Halılarınızı en son ${gunTR(s.sonTeslim)} tarihinde ${s.businessName} yıkamıştı. Yeniden sipariş vermek için: ${base}/halici/${s.businessId}`,
        mesajHtml(s, base),
      );
      gonderilen++;
    } catch (e) {
      console.error("[sezon-hatirlatma] e-posta hatasi:", e);
    }
  }
  if (gonderilen > 0)
    console.log(
      `[sezon-hatirlatma] ${gonderilen} müşteriye gönderildi (${sezonAy} ay eşiği)`,
    );
}
