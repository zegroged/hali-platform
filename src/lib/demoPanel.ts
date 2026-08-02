import crypto from "node:crypto";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getSessionSecret } from "@/lib/config";
import { saveObject } from "@/lib/storage";
import { CONTRACT_VERSION } from "@/lib/legal";
import { districtsOfCity } from "@/lib/cities";
import { genOrderCode } from "@/lib/ordercode";

// KOMİSYONCU DEMO PANELİ (2026-07-30).
//
// SORUN: komisyoncu dükkânda ürünü GÖSTEREMİYORDU. /komisyoncu yalnız kendi
// kazancını gösteriyor; satış el kitabımız ise "siteyi telefondan aç, göster —
// görmek inanmaktır" diyor. Elinde gösterecek bir panel yoktu; olsa bile boş
// bir panel hiçbir şey satmaz ("burada siparişleriniz görünecek" boş ekranı,
// halıcıyı 2.000 TL/ay ödemeye ikna etmez).
//
// ÇÖZÜM: her komisyoncuya, kendi adına açılmış, GERÇEKÇİ veriyle dolu bir
// işletme hesabı. Şoförü mesaide, siparişleri farklı aşamalarda, kasası aylık
// gelir-gider dolu, yorumları ve fiyat listesi var.
//
// 🔴 EN KRİTİK KISIM GÖSTERİM DEĞİL, İZOLASYON: bu işletme GERÇEK SAYILARA
// SIZMAMALI. `CleanerBusiness.isDemo` tek bayrak olarak şu yerlerde elenir:
//   - lib/seoCoverage.ts gizliFiltre → keşif + sitemap + il/ilçe kapsamı +
//     ana sayfa il butonları + "şehrinde halıcı açıldı" müjde maili
//   - lib/businesses.ts getRecentReviews (ana sayfa yorum vitrini)
//   - lib/territory.ts bölge haritası işletme sayıları
//   - app/admin/page.tsx sayaçları ve geciken sipariş listesi
//   - lib/commission.ts tahakkuk (kendi demosundan komisyon = suistimal)
//   - lib/orderSla.ts, lib/weeklyDigest.ts, lib/subscriptionReminder.ts
//   - abonelik/ödeme akışı (panel/subscription-actions.ts)
//   - WhatsApp gönderimi (lib/whatsapp.ts waGonderVeKaydet)
//
// TELEFONLAR SAHTE VE WHATSAPP'TA OLMAYAN ARALIKTAN: 0500 Türkiye'de bir
// operatöre TAHSİS EDİLMEMİŞ mobil koddur (bkz. lib/phone.ts
// TR_GSM_OPERATOR_RE). Biçimsel olarak geçerli cep gibi görünür — panel ve
// şoför ekranları normal çalışır — ama o numarada WhatsApp hesabı olamaz, yani
// demo sırasında yapılan hiçbir işlem gerçek birine bildirim göndermez.

/** Demo hesaplarının telefon öneki — tahsissiz mobil kod (WhatsApp'ta yok). */
const DEMO_TEL_ONEK = "0500";

/** Demo e-posta alan adı: `.invalid` RFC 2606 ile ASLA çözümlenmez. */
const DEMO_EPOSTA_ALAN = "demo.invalid";

/** Kimlik türetme eki: aynı komisyoncu için her zaman aynı kullanıcı adı. */
function ek(agentId: string): string {
  return crypto.createHash("sha256").update(agentId).digest("hex").slice(0, 6);
}

/**
 * Demo şifresi — HİÇBİR YERDE SAKLANMAZ, oturum sırrından TÜRETİLİR.
 *
 * NEDEN: şifre komisyoncuya ekranda tekrar tekrar gösterilmeli ("demo panelim"
 * kutusu her açılışta göstermeli), ama düz metin şifreyi veritabanına yazmak
 * kötü bir alışkanlıktır ve şema da kilitli. Türetme her ikisini de çözer:
 * ekranda gösterilebilir, veritabanında yalnız bcrypt özeti durur.
 */
export function demoSifre(agentId: string, rol: string): string {
  const mac = crypto
    .createHmac("sha256", getSessionSecret())
    .update(`demo-panel:${rol}:${agentId}`)
    .digest("hex");
  return `Demo${mac.slice(0, 8)}`;
}

export function demoKullaniciAdi(agentId: string, rol: string): string {
  const e = ek(agentId);
  return rol === "owner" ? `demo.${e}` : `demo.${rol}.${e}`;
}

/** Kullanılmayan bir 0500'lü numara bul (User.phone @unique). */
async function bosTelefon(tohum: string): Promise<string> {
  const h = crypto.createHash("sha256").update(tohum).digest();
  // İlk aday türetilmiş: aynı komisyoncu sıfırladığında aynı numara geri gelir.
  const adaylar = [
    DEMO_TEL_ONEK + (h.readUInt32BE(0) % 10_000_000).toString().padStart(7, "0"),
  ];
  for (let i = 0; i < 12; i++) {
    adaylar.push(
      DEMO_TEL_ONEK + crypto.randomInt(0, 10_000_000).toString().padStart(7, "0"),
    );
  }
  for (const aday of adaylar) {
    const dolu = await prisma.user.findUnique({
      where: { phone: aday },
      select: { id: true },
    });
    if (!dolu) return aday;
  }
  throw new Error("Demo için boş telefon numarası bulunamadı.");
}

// ---------------------------------------------------------------- görseller

/**
 * Demo fotoğrafı üret. Gerçek fotoğraf yükleyemeyiz (dosyamız yok) ama
 * fotoğrafsız panel "eksik profil" uyarısıyla açılır ve satışı baltalar.
 * SVG → WebP; sharp'ta SVG desteği yoksa düz renk kareye düşülür.
 */
async function demoGorsel(
  businessId: string,
  baslik: string,
  altBaslik: string,
  renk: [number, number, number],
): Promise<string | null> {
  const [r, g, b] = renk;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <rect width="1200" height="800" fill="rgb(${r},${g},${b})"/>
    <rect x="60" y="60" width="1080" height="680" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="6"/>
    <text x="600" y="380" font-family="sans-serif" font-size="76" font-weight="bold" fill="#ffffff" text-anchor="middle">${baslik}</text>
    <text x="600" y="460" font-family="sans-serif" font-size="40" fill="rgba(255,255,255,0.85)" text-anchor="middle">${altBaslik}</text>
  </svg>`;
  let buf: Buffer;
  try {
    buf = await sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
  } catch {
    // SVG desteği yoksa: düz renk kare (panel yine "fotoğraf var" sayar).
    buf = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: { r, g, b } },
    })
      .webp({ quality: 80 })
      .toBuffer();
  }
  try {
    const ad = `demo-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.webp`;
    return await saveObject(`uploads/${businessId}/${ad}`, buf, "image/webp");
  } catch {
    // Depolama erişilemezse demo yine kurulsun (fotoğrafsız).
    return null;
  }
}

// ---------------------------------------------------------------- okuma

export type DemoBilgi = {
  businessId: string;
  isletmeAdi: string;
  city: string;
  district: string;
  kullaniciAdi: string;
  sifre: string;
  soforKullaniciAdi: string;
  soforSifre: string;
  siparisSayisi: number;
  olusturuldu: Date;
};

/** Bu komisyoncunun demo paneli (yoksa null). */
export async function demoPaneliOku(agentId: string): Promise<DemoBilgi | null> {
  const b = await prisma.cleanerBusiness.findFirst({
    where: { isDemo: true, referredByAgentId: agentId },
    select: {
      id: true,
      name: true,
      city: true,
      district: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });
  if (!b) return null;
  return {
    businessId: b.id,
    isletmeAdi: b.name,
    city: b.city,
    district: b.district,
    kullaniciAdi: demoKullaniciAdi(agentId, "owner"),
    sifre: demoSifre(agentId, "owner"),
    soforKullaniciAdi: demoKullaniciAdi(agentId, "sofor1"),
    soforSifre: demoSifre(agentId, "sofor1"),
    siparisSayisi: b._count.orders,
    olusturuldu: b.createdAt,
  };
}

// ---------------------------------------------------------------- silme

/**
 * Demo panelini KÖKÜNDEN sil (sıfırlama ve hesap temizliği).
 *
 * SİLME SIRASI ZORUNLU: Order → business ilişkisinde `onDelete` YOK (Restrict),
 * yani siparişler durdukça işletme silinemez. İşletme silinince şoför/fiyat/
 * kasa/yorum kayıtları cascade ile gider; kullanıcı hesapları ise ayrı silinir
 * (CleanerBusiness.owner ilişkisi User'ı silmez).
 */
export async function demoPaneliSil(agentId: string): Promise<boolean> {
  const b = await prisma.cleanerBusiness.findFirst({
    where: { isDemo: true, referredByAgentId: agentId },
    select: {
      id: true,
      ownerId: true,
      drivers: { select: { userId: true } },
    },
  });
  if (!b) return false;
  const kullaniciIdleri = [b.ownerId, ...b.drivers.map((d) => d.userId)];

  await prisma.order.deleteMany({ where: { businessId: b.id } });
  await prisma.cleanerBusiness.delete({ where: { id: b.id } });
  // GÜVENLİK AĞI: yalnız demo kullanıcıları sil. Rol + telefon öneki birlikte
  // aranır ki bir kimlik karışması gerçek bir hesabı silmesin.
  await prisma.user.deleteMany({
    where: {
      id: { in: kullaniciIdleri },
      role: { in: ["CLEANER", "DRIVER"] },
      phone: { startsWith: DEMO_TEL_ONEK },
    },
  });
  return true;
}

/**
 * ARTIK TEMİZLİĞİ — kurulumdan önce çalışır.
 *
 * NEDEN GEREKLİ: kullanıcı adları komisyoncu kimliğinden TÜRETİLİYOR
 * (`demo.<ek>`) ve `User.username` benzersiz. Yarım kalmış bir kurulum ya da
 * eksik silme sonrası artakalan bir hesap, "yeniden oluştur"u sonsuza kadar
 * P2002 ile kilitlerdi. Yalnız türetilmiş adları + demo telefon önekini
 * taşıyan hesaplara dokunur; gerçek bir hesabı silmesi mümkün değildir.
 */
async function artiklariTemizle(agentId: string): Promise<void> {
  await demoPaneliSil(agentId);
  const adlar = ["owner", "sofor1", "sofor2"].map((r) =>
    demoKullaniciAdi(agentId, r),
  );
  const artiklar = await prisma.user.findMany({
    where: {
      username: { in: adlar },
      role: { in: ["CLEANER", "DRIVER"] },
      phone: { startsWith: DEMO_TEL_ONEK },
    },
    select: {
      id: true,
      ownedBusiness: {
        select: { id: true, isDemo: true, referredByAgentId: true },
      },
    },
  });
  for (const u of artiklar) {
    const biz = u.ownedBusiness;
    // Sahip olduğu işletme DEMO değilse dokunma (olmaması gereken durum —
    // sessiz veri kaybı yerine hesabı olduğu gibi bırak).
    if (biz && !biz.isDemo) continue;
    // 🔴 SAHİPLİK KONTROLÜ (2026-07-30, 4.43 bulgusu): kullanıcı adı eki
    // sha256'nın İLK 6 HANESİ — iki komisyoncunun eki çakışırsa buradaki
    // silme BAŞKA komisyoncunun CANLI demosunu yok ederdi. İşletmesi olan
    // artık ancak BU komisyoncuya bağlıysa silinir (işletmesiz yarım hesap
    // için sahiplik bilgisi yok — o eski davranışla temizlenir).
    // null = sahipsiz artik (yarim kurulum) — temizlenebilir; yoksa P2002
    // kilidi sonsuza kalirdi. Dolu ve BASKASINA aitse dokunulmaz.
    if (biz && biz.referredByAgentId != null && biz.referredByAgentId !== agentId)
      continue;
    if (biz) {
      await prisma.order.deleteMany({ where: { businessId: biz.id } });
      await prisma.cleanerBusiness.delete({ where: { id: biz.id } });
    }
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
  }
}

// ---------------------------------------------------------------- tohumlama

const GUN = 24 * 60 * 60 * 1000;
const SAAT = 60 * 60 * 1000;

/** Gerçekçi ama tanınabilir sahte müşteriler. */
const MUSTERILER = [
  { ad: "Ayşe Yıldırım", adres: "Barbaros Mah. Zeytin Sok. No:14 D:5" },
  { ad: "Mehmet Aslan", adres: "Cumhuriyet Mah. Lale Cad. No:3 D:11" },
  { ad: "Zeynep Korkmaz", adres: "Fatih Mah. Menekşe Sok. No:22 D:2" },
  { ad: "Hasan Şahin", adres: "Yeni Mah. Gül Sok. No:7" },
  { ad: "Elif Demirtaş", adres: "Atatürk Bulvarı No:118 D:9" },
  { ad: "Osman Çetin", adres: "İstiklal Mah. Çınar Cad. No:41 D:4" },
  { ad: "Fatma Erdoğan", adres: "Kurtuluş Mah. Papatya Sok. No:9 D:6" },
  { ad: "Kemal Aydın", adres: "Bahçelievler Mah. Defne Sok. No:2" },
  { ad: "Sultan Otel İşletmeciliği", adres: "Sahil Yolu Cad. No:250" },
  { ad: "Merve Polat", adres: "Yeşiltepe Mah. Manolya Sok. No:16 D:3" },
  { ad: "Burak Şen", adres: "Şehit Er Sok. No:5 D:1" },
  { ad: "Hatice Kurt", adres: "Alparslan Mah. Sedir Cad. No:33 D:8" },
];

/** Sipariş kodu çakışırsa (P2002) yeni kodla dene — genOrderCode ~1 milyar. */
async function siparisOlustur(
  data: Omit<Prisma.OrderUncheckedCreateInput, "code">,
): Promise<{ id: string }> {
  for (let i = 0; i < 6; i++) {
    try {
      return await prisma.order.create({
        data: { ...data, code: genOrderCode() },
        select: { id: true },
      });
    } catch (e) {
      const kod = (e as { code?: string })?.code;
      if (kod !== "P2002") throw e;
    }
  }
  throw new Error("Demo siparişi için benzersiz kod üretilemedi.");
}

/**
 * Komisyoncuya demo panel kur. Zaten varsa DOKUNMAZ (çağıran önce siler).
 * Yarım kalırsa temizler — yetim kullanıcı/işletme bırakmaz.
 */
export async function demoPaneliKur(agentId: string): Promise<DemoBilgi> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      user: { select: { name: true } },
      territories: {
        select: { city: true, district: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  if (!agent) throw new Error("Komisyoncu bulunamadı.");

  // Türetilmiş kullanıcı adları benzersiz olmak zorunda: önceki denemeden
  // artakalan hesap varsa temizle, yoksa kurulum sonsuza kadar P2002 verir.
  await artiklariTemizle(agentId);

  // Demo, komisyoncunun KENDİ bölgesinde açılır — dükkânda gösterirken
  // "senin ilçen" görünmesi ikna gücünü artırır. Bölgesi yoksa İstanbul.
  const city = agent.territories[0]?.city || "İstanbul";
  const district = agent.territories[0]?.district || "Kadıköy";
  // Koordinat sabit (ağ çağrısı yok): demo keşifte zaten görünmediğinden
  // mesafe sıralamasına girmiyor. Şoför konumları buna göre kaydırılır ki
  // paneldeki harita kendi içinde tutarlı olsun.
  const lat = 41.0082;
  const lng = 28.9784;

  const ilceler = districtsOfCity(city);
  const hizmetIlceleri = Array.from(
    new Set([district, ...ilceler.slice(0, 3)]),
  ).slice(0, 3);

  const ownerTel = await bosTelefon(agentId + ":owner");
  const sofor1Tel = await bosTelefon(agentId + ":sofor1");
  const sofor2Tel = await bosTelefon(agentId + ":sofor2");
  const e = ek(agentId);

  const isletmeAdi = "Örnek Halı Yıkama (Demo)";
  const simdi = Date.now();
  const farFuture = new Date("2099-12-31T00:00:00.000Z");

  let businessId: string | null = null;
  try {
    const owner = await prisma.user.create({
      data: {
        role: "CLEANER",
        name: "Ahmet Yıldız",
        phone: ownerTel,
        username: demoKullaniciAdi(agentId, "owner"),
        email: `demo.${e}@${DEMO_EPOSTA_ALAN}`,
        emailVerified: true, // demo panelde "e-postanı doğrula" uyarısı çıkmasın
        phoneVerified: true,
        password: await hashPassword(demoSifre(agentId, "owner")),
        ownedBusiness: {
          create: {
            name: isletmeAdi,
            // Yanlışlıkla profili açan biri ne olduğunu ilk satırda görsün.
            description:
              "Bu kayıt bir DEMO panelidir — tanıtım amacıyla oluşturulmuştur, gerçek sipariş almaz.",
            isDemo: true,
            referredByAgentId: agentId, // sahiplik bağı: "hangi komisyoncunun demosu"
            address: `${district}, ${city}`,
            city,
            district,
            lat,
            lng,
            phone: ownerTel,
            landlinePhone: null,
            taxNumber: "6120458793",
            billingTitle: "Örnek Halı Yıkama Ltd. Şti. (Demo)",
            taxOffice: "Demo Vergi Dairesi",
            billingAddress: `${district}, ${city}`,
            deliveryEstimateMinDays: 2,
            deliveryEstimateMaxDays: 3,
            workingHours: {
              mon: { open: "08:30", close: "19:00" },
              tue: { open: "08:30", close: "19:00" },
              wed: { open: "08:30", close: "19:00" },
              thu: { open: "08:30", close: "19:00" },
              fri: { open: "08:30", close: "19:00" },
              sat: { open: "09:00", close: "17:00" },
              sun: null,
            },
            // Rozetler demonun konusudur (paketin satılan özelliği), gerçek
            // müşteriye çıkmaz: demo keşifte ve aramada yok.
            verification: "VERIFIED",
            isVisible: true,
            contractAcceptedAt: new Date(),
            contractVersion: CONTRACT_VERSION,
            adminNote: `Komisyoncu demo paneli — ${agent.user.name}. Sayaçlara, keşfe ve komisyona GİRMEZ.`,
            ratingAvg: 4.7,
            ratingCount: 3,
            serviceAreas: {
              create: hizmetIlceleri.map((d) => ({ city, district: d })),
            },
            pricing: {
              create: [
                { label: "Makine Halısı", unit: "PER_M2", price: 120 },
                { label: "Yün / El Dokuma Halı", unit: "PER_M2", price: 185 },
                { label: "Shaggy / Uzun Tüylü", unit: "PER_M2", price: 150 },
                { label: "Yolluk (adet)", unit: "PER_PIECE", price: 350 },
                {
                  label: "Saçak Onarımı",
                  unit: "PER_PIECE",
                  price: 250,
                  isAddon: true,
                },
                {
                  label: "Leke / Koku Giderme",
                  unit: "FLAT",
                  price: 400,
                  isAddon: true,
                },
              ],
            },
            badges: { create: [{ type: "VERIFIED" }, { type: "INSURED" }] },
            subscription: {
              create: {
                status: "ACTIVE",
                currentPeriodStart: new Date(),
                currentPeriodEnd: farFuture, // demo ödeme akışına girmez
              },
            },
          },
        },
      },
      include: { ownedBusiness: { select: { id: true } } },
    });
    businessId = owner.ownedBusiness!.id;

    // ---- Fotoğraflar (profil "tam" görünsün) ----
    // hali1..3: "Halı Bul" ekranının demosu için AYRI GÖRÜNEN üç halı — aynı
    // müşterinin 3 halısı numaralanmış olarak görünsün (2026-08-02). Tek bir
    // görseli üç kez kullanmak numaralamayı anlatmıyordu.
    const [genel, oncesi, sonrasi, alimFoto, yikamaFoto, teslimFoto, hali1, hali2, hali3] =
      await Promise.all([
        demoGorsel(businessId, "Örnek Halı Yıkama", "Dükkân görseli", [15, 118, 110]),
        demoGorsel(businessId, "ÖNCESİ", "Yıkama öncesi", [120, 83, 55]),
        demoGorsel(businessId, "SONRASI", "Yıkama sonrası", [30, 130, 176]),
        demoGorsel(businessId, "ALIM", "Halı teslim alındı", [71, 85, 105]),
        demoGorsel(businessId, "YIKAMA", "Yıkama hattında", [13, 148, 136]),
        demoGorsel(businessId, "TESLİM", "Kapıda teslim", [22, 101, 52]),
        demoGorsel(businessId, "HALI 1", "Salon halısı", [124, 45, 18]),
        demoGorsel(businessId, "HALI 2", "Yolluk", [67, 56, 202]),
        demoGorsel(businessId, "HALI 3", "Shaggy", [161, 98, 7]),
      ]);
    const fotolar: { url: string; isBefore: boolean; isAfter: boolean; caption: string }[] =
      [];
    if (genel) fotolar.push({ url: genel, isBefore: false, isAfter: false, caption: "Tesisimiz" });
    if (oncesi) fotolar.push({ url: oncesi, isBefore: true, isAfter: false, caption: "Yıkama öncesi" });
    if (sonrasi) fotolar.push({ url: sonrasi, isBefore: false, isAfter: true, caption: "Yıkama sonrası" });
    if (fotolar.length) {
      await prisma.businessPhoto.createMany({
        data: fotolar.map((f) => ({ businessId: businessId!, ...f })),
      });
    }
    if (genel) {
      await prisma.cleanerBusiness.update({
        where: { id: businessId },
        data: { logoUrl: genel },
      });
    }

    // ---- Şoförler: biri MESAİDE (canlı takip demosu için) ----
    const sofor1User = await prisma.user.create({
      data: {
        role: "DRIVER",
        name: "Mehmet Kaya",
        phone: sofor1Tel,
        username: demoKullaniciAdi(agentId, "sofor1"),
        password: await hashPassword(demoSifre(agentId, "sofor1")),
      },
    });
    const sofor1 = await prisma.driver.create({
      data: {
        userId: sofor1User.id,
        businessId,
        isOnShift: true,
        lastLat: lat + 0.012,
        lastLng: lng + 0.009,
        lastSeenAt: new Date(simdi - 4 * 60 * 1000),
        privacyNoticeAt: new Date(), // demo sırasında KVKK penceresi açılmasın
      },
      select: { id: true },
    });
    const sofor2User = await prisma.user.create({
      data: {
        role: "DRIVER",
        name: "Ali Doğan",
        phone: sofor2Tel,
        username: demoKullaniciAdi(agentId, "sofor2"),
        password: await hashPassword(demoSifre(agentId, "sofor2")),
      },
    });
    const sofor2 = await prisma.driver.create({
      data: {
        userId: sofor2User.id,
        businessId,
        isOnShift: false,
        lastLat: lat - 0.007,
        lastLng: lng - 0.014,
        lastSeenAt: new Date(simdi - 9 * SAAT),
        privacyNoticeAt: new Date(),
      },
      select: { id: true },
    });

    // ---- Siparişler: her aşamadan en az bir tane ----
    const tel = (i: number) =>
      DEMO_TEL_ONEK + String(2000000 + i * 13579).slice(0, 7);

    const yeni = (i: number) => MUSTERILER[i % MUSTERILER.length];

    // 1) Yeni talep — panelin "bekleyen sipariş" rozeti dolsun.
    const s1 = yeni(0);
    await siparisOlustur({
      businessId,
      customerName: s1.ad,
      customerPhone: tel(0),
      pickupAddress: `${s1.adres}, ${district}/${city}`,
      pickupLat: lat + 0.004,
      pickupLng: lng + 0.006,
      approxM2: 18,
      note: "3 oda halısı, biri shaggy.",
      status: "CREATED",
      paymentMethod: "CASH",
      createdAt: new Date(simdi - 40 * 60 * 1000),
      events: { create: [{ status: "CREATED", note: "Müşteri sipariş oluşturdu" }] },
    });

    // 2) Kabul edildi — fiyat bildirimi + müşteri onayı zinciri görünsün.
    const s2 = yeni(1);
    await siparisOlustur({
      businessId,
      driverId: sofor1.id,
      customerName: s2.ad,
      customerPhone: tel(1),
      pickupAddress: `${s2.adres}, ${district}/${city}`,
      pickupLat: lat + 0.011,
      pickupLng: lng - 0.003,
      approxM2: 24,
      status: "ACCEPTED",
      paymentMethod: "CASH",
      quotedPrice: 2880,
      priceApprovedAt: new Date(simdi - 2 * SAAT),
      estimatedDays: 3,
      createdAt: new Date(simdi - 5 * SAAT),
      events: {
        create: [
          { status: "CREATED", note: "Müşteri sipariş oluşturdu" },
          { status: "ACCEPTED", note: "Kesin fiyat bildirildi: 2.880 TL" },
        ],
      },
    });

    // 3) Halı alındı — alım fotoğrafı (OrderPhoto.stage = ALIM).
    const s3 = yeni(2);
    await siparisOlustur({
      businessId,
      driverId: sofor1.id,
      customerName: s3.ad,
      customerPhone: tel(2),
      pickupAddress: `${s3.adres}, ${district}/${city}`,
      pickupLat: lat - 0.005,
      pickupLng: lng + 0.012,
      approxM2: 12,
      status: "PICKED_UP",
      paymentMethod: "CASH",
      quotedPrice: 1440,
      priceApprovedAt: new Date(simdi - 20 * SAAT),
      estimatedDays: 2,
      pickupPhotoUrl: alimFoto,
      createdAt: new Date(simdi - GUN),
      ...(alimFoto
        ? { photos: { create: [{ url: alimFoto, stage: "ALIM" }] } }
        : {}),
      events: {
        create: [
          { status: "CREATED", note: "Müşteri sipariş oluşturdu" },
          { status: "ACCEPTED", note: "Kabul edildi" },
          { status: "PICKED_UP", note: "Şoför halıyı teslim aldı (fotoğraflı)" },
        ],
      },
    });

    // 4) Yıkanıyor — yıkama aşaması fotoğrafı.
    const s4 = yeni(3);
    await siparisOlustur({
      businessId,
      driverId: sofor2.id,
      customerName: s4.ad,
      customerPhone: tel(3),
      pickupAddress: `${s4.adres}, ${district}/${city}`,
      approxM2: 30,
      status: "WASHING",
      paymentMethod: "CASH",
      quotedPrice: 3600,
      priceApprovedAt: new Date(simdi - 2 * GUN),
      estimatedDays: 3,
      pickupPhotoUrl: alimFoto,
      createdAt: new Date(simdi - 2 * GUN),
      // HALI BUL demosu: bu müşterinin ÜÇ halısı var, her biri numaralı.
      // Şoförün ALIM kanıt fotoğrafı numarasız (yükün tamamının karesi).
      ...(alimFoto && hali1 && hali2 && hali3
        ? {
            photos: {
              create: [
                { url: alimFoto, stage: "ALIM" },
                { url: hali1, stage: "YIKAMA", carpetNo: 1 },
                { url: hali2, stage: "YIKAMA", carpetNo: 2 },
                { url: hali3, stage: "YIKAMA", carpetNo: 3 },
              ],
            },
          }
        : {}),
      events: {
        create: [
          { status: "CREATED", note: "Müşteri sipariş oluşturdu" },
          { status: "ACCEPTED", note: "Kabul edildi" },
          { status: "PICKED_UP", note: "Halı alındı" },
          { status: "WASHING", note: "Yıkama hattına verildi" },
        ],
      },
    });

    // 5) Yola çıktı — mesaideki şoför + canlı konum demosu.
    const s5 = yeni(4);
    await siparisOlustur({
      businessId,
      driverId: sofor1.id,
      customerName: s5.ad,
      customerPhone: tel(4),
      pickupAddress: `${s5.adres}, ${district}/${city}`,
      pickupLat: lat + 0.016,
      pickupLng: lng + 0.011,
      approxM2: 16,
      status: "OUT_FOR_DELIVERY",
      paymentMethod: "CASH",
      quotedPrice: 1920,
      priceTotal: 1920,
      priceApprovedAt: new Date(simdi - 3 * GUN),
      estimatedDays: 3,
      createdAt: new Date(simdi - 3 * GUN),
      ...(yikamaFoto
        ? { photos: { create: [{ url: yikamaFoto, stage: "YIKAMA", carpetNo: 1 }] } }
        : {}),
      events: {
        create: [
          { status: "CREATED", note: "Müşteri sipariş oluşturdu" },
          { status: "ACCEPTED", note: "Kabul edildi" },
          { status: "PICKED_UP", note: "Halı alındı" },
          { status: "WASHING", note: "Yıkandı" },
          { status: "OUT_FOR_DELIVERY", note: "Şoför teslimata çıktı" },
        ],
      },
    });

    // 6) Teslim edildi — NAKİT tahsil edildi (bugün; mutabakat ekranı için).
    const s6 = yeni(5);
    const teslim1 = await siparisOlustur({
      businessId,
      driverId: sofor1.id,
      customerName: s6.ad,
      customerPhone: tel(5),
      pickupAddress: `${s6.adres}, ${district}/${city}`,
      approxM2: 40,
      status: "DELIVERED",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      quotedPrice: 4850,
      priceTotal: 4850,
      priceApprovedAt: new Date(simdi - 4 * GUN),
      deliveredAt: new Date(simdi - 5 * SAAT),
      deliveryPhotoUrl: teslimFoto,
      collectedAmount: 4850,
      collectedAt: new Date(simdi - 5 * SAAT),
      collectedById: sofor1User.id,
      collectedMethod: "CASH",
      createdAt: new Date(simdi - 4 * GUN),
      ...(teslimFoto
        ? { photos: { create: [{ url: teslimFoto, stage: "TESLIM" }] } }
        : {}),
      events: {
        create: [
          { status: "CREATED", note: "Müşteri sipariş oluşturdu" },
          { status: "DELIVERED", note: "Teslim edildi · 4.850 TL nakit tahsil edildi" },
        ],
      },
    });

    // 7) Teslim edildi ama TAHSİL EDİLMEDİ (kurumsal cari) — "teslim = ödendi"
    //    değildir; mutabakat ekranının varlık sebebi tam olarak bu satırdır.
    const s7 = MUSTERILER[8];
    await siparisOlustur({
      businessId,
      driverId: sofor1.id,
      customerName: s7.ad,
      customerPhone: tel(6),
      pickupAddress: `${s7.adres}, ${district}/${city}`,
      approxM2: 55,
      note: "Ay sonu faturalı ödeme (kurumsal).",
      status: "DELIVERED",
      paymentMethod: "CASH",
      quotedPrice: 6600,
      priceTotal: 6600,
      priceApprovedAt: new Date(simdi - 4 * GUN),
      deliveredAt: new Date(simdi - 6 * SAAT),
      createdAt: new Date(simdi - 4 * GUN),
      events: {
        create: [
          { status: "CREATED", note: "Müşteri sipariş oluşturdu" },
          { status: "DELIVERED", note: "Teslim edildi · tahsilat ay sonu" },
        ],
      },
    });

    // 8) Teslim edildi — IBAN ile tahsil (şoförün üzerinde nakit BIRAKMAZ).
    const s8 = yeni(6);
    const teslim2 = await siparisOlustur({
      businessId,
      driverId: sofor2.id,
      customerName: s8.ad,
      customerPhone: tel(7),
      pickupAddress: `${s8.adres}, ${district}/${city}`,
      approxM2: 20,
      status: "DELIVERED",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      quotedPrice: 2400,
      priceTotal: 2400,
      deliveredAt: new Date(simdi - 8 * SAAT),
      collectedAmount: 2400,
      collectedAt: new Date(simdi - 8 * SAAT),
      collectedById: sofor2User.id,
      collectedMethod: "IBAN",
      createdAt: new Date(simdi - 5 * GUN),
      events: {
        create: [
          { status: "CREATED", note: "Müşteri sipariş oluşturdu" },
          { status: "DELIVERED", note: "Teslim edildi · 2.400 TL IBAN ile tahsil" },
        ],
      },
    });

    // 9) Reddedilmiş sipariş — panelin red akışı da boş durmasın.
    const s9 = yeni(7);
    await siparisOlustur({
      businessId,
      customerName: s9.ad,
      customerPhone: tel(8),
      pickupAddress: `${s9.adres}, ${district}/${city}`,
      approxM2: 8,
      status: "REJECTED",
      rejectReason: "Hizmet bölgesi dışı",
      createdAt: new Date(simdi - 6 * GUN),
      events: {
        create: [
          { status: "CREATED", note: "Müşteri sipariş oluşturdu" },
          { status: "REJECTED", note: "Hizmet bölgesi dışı" },
        ],
      },
    });

    // ---- Geçmiş aylar: KASA'nın aylık gelir grafiği boş kalmasın ----
    const teslimGecmis: string[] = [];
    for (let ayOnce = 1; ayOnce <= 2; ayOnce++) {
      for (let k = 0; k < 2; k++) {
        const m = MUSTERILER[(ayOnce * 3 + k) % MUSTERILER.length];
        // Ay geriye alırken setMonth KULLANILMAZ: ayın 31'inde çağrılırsa
        // 30 günlük aya taşar ve kayıt yanlış aya düşer. Yapıcıya doğrudan
        // (yıl, ay, gün) vermek taşmayı baştan engeller.
        const bugun = new Date();
        const gun = new Date(
          bugun.getFullYear(),
          bugun.getMonth() - ayOnce,
          10 + k * 9,
          14,
          0,
          0,
          0,
        );
        const tutar = 3200 + ayOnce * 450 + k * 900;
        const o = await siparisOlustur({
          businessId,
          driverId: k === 0 ? sofor1.id : sofor2.id,
          customerName: m.ad,
          customerPhone: tel(9 + ayOnce * 2 + k),
          pickupAddress: `${m.adres}, ${district}/${city}`,
          approxM2: 20 + k * 6,
          status: "DELIVERED",
          paymentMethod: "CASH",
          paymentStatus: "PAID",
          priceTotal: tutar,
          quotedPrice: tutar,
          deliveredAt: gun,
          collectedAmount: tutar,
          collectedAt: gun,
          collectedById: k === 0 ? sofor1User.id : sofor2User.id,
          collectedMethod: "CASH",
          createdAt: new Date(gun.getTime() - 3 * GUN),
          events: { create: [{ status: "DELIVERED", note: "Teslim edildi" }] },
        });
        teslimGecmis.push(o.id);
      }
    }

    // ---- Yorumlar (sipariş başına 1; Review.orderId @unique) ----
    await prisma.review.createMany({
      data: [
        {
          orderId: teslim1.id,
          businessId,
          rating: 5,
          comment:
            "Halılarımı kapıdan aldılar, iki günde tertemiz teslim ettiler. Kokusu bile kalmamış.",
          createdAt: new Date(simdi - 4 * SAAT),
        },
        {
          orderId: teslim2.id,
          businessId,
          rating: 5,
          comment: "Şoför bey çok ilgiliydi, fiyat baştan netti. Tavsiye ederim.",
          createdAt: new Date(simdi - 7 * SAAT),
        },
        {
          orderId: teslimGecmis[0],
          businessId,
          rating: 4,
          comment: "İş güzel, teslim bir gün gecikti ama haber verdiler.",
          createdAt: new Date(simdi - 25 * GUN),
        },
      ],
    });

    // ---- Şoförden halıcıya nakit devri (gün sonu mutabakatı) ----
    await prisma.cashHandover.createMany({
      data: [
        {
          businessId,
          driverId: sofor1.id,
          driverName: "Mehmet Kaya",
          amount: 3000,
          note: "Öğlen ara teslimi",
          createdAt: new Date(simdi - 3 * SAAT),
        },
        {
          businessId,
          driverId: sofor2.id,
          driverName: "Ali Doğan",
          amount: 1750,
          note: "Dünkü nakit",
          createdAt: new Date(simdi - GUN),
        },
      ],
    });

    // ---- KASA: son 3 ayın gider/gelir kalemleri ----
    const kasa: {
      kind: "EXPENSE" | "INCOME";
      category:
        | "PERSONEL"
        | "MALZEME"
        | "KIRA"
        | "FATURA"
        | "YAKIT"
        | "ARAC"
        | "VERGI"
        | "DIGER";
      categoryLabel?: string;
      label: string;
      amount: number;
      gun: number;
    }[] = [
      { kind: "EXPENSE", category: "KIRA", label: "Dükkân kirası", amount: 28000, gun: 1 },
      { kind: "EXPENSE", category: "PERSONEL", label: "Mehmet — maaş", amount: 24500, gun: 5 },
      { kind: "EXPENSE", category: "PERSONEL", label: "Ali — maaş", amount: 23000, gun: 5 },
      { kind: "EXPENSE", category: "MALZEME", categoryLabel: "Deterjan", label: "Halı şampuanı 20 kg", amount: 3200, gun: 8 },
      { kind: "EXPENSE", category: "FATURA", label: "Elektrik + su", amount: 7400, gun: 12 },
      { kind: "EXPENSE", category: "YAKIT", label: "Kamyonet yakıt", amount: 5200, gun: 15 },
      { kind: "EXPENSE", category: "VERGI", label: "SGK + muhasebe", amount: 9800, gun: 20 },
      { kind: "INCOME", category: "DIGER", label: "Dükkâna gelen nakit yıkama", amount: 4200, gun: 22 },
    ];
    const kasaSatirlari: {
      businessId: string;
      kind: "EXPENSE" | "INCOME";
      category: (typeof kasa)[number]["category"];
      categoryLabel: string | null;
      label: string;
      amount: number;
      date: Date;
    }[] = [];
    const bugun = new Date();
    for (let ayOnce = 0; ayOnce <= 2; ayOnce++) {
      for (const k of kasa) {
        // (yıl, ay, gün) yapıcısı: setMonth ay-sonu taşmasını yapar, bu yapmaz.
        const d = new Date(
          bugun.getFullYear(),
          bugun.getMonth() - ayOnce,
          k.gun,
          9,
          0,
          0,
          0,
        );
        if (d.getTime() > simdi) continue; // gelecek tarihli kalem yazma
        kasaSatirlari.push({
          businessId,
          kind: k.kind,
          category: k.category,
          categoryLabel: k.categoryLabel ?? null,
          label: k.label,
          amount: k.amount,
          date: d,
        });
      }
    }
    await prisma.ledgerEntry.createMany({ data: kasaSatirlari });

    // ---- Tekrarlayan gider kuralları (vadesi GELECEKTE: demo kurulur kurulmaz
    //      arka arkaya kayıt üretip listeyi kirletmesin) ----
    const ucGunSonra = new Date(simdi + 3 * GUN);
    const gelecekAyinBesi = new Date(
      bugun.getFullYear(),
      bugun.getMonth() + 1,
      5,
      9,
      0,
      0,
      0,
    );
    await prisma.ledgerRecurrence.createMany({
      data: [
        {
          businessId,
          kind: "EXPENSE",
          category: "MALZEME",
          label: "Halı şampuanı 20 kg",
          amount: 3200,
          everyDays: 3,
          nextRunAt: ucGunSonra,
        },
        {
          businessId,
          kind: "EXPENSE",
          category: "PERSONEL",
          label: "Personel maaşları",
          amount: 47500,
          monthDay: 5,
          nextRunAt: gelecekAyinBesi,
        },
      ],
    });

    const bilgi = await demoPaneliOku(agentId);
    if (!bilgi) throw new Error("Demo panel kuruldu ama okunamadı.");
    return bilgi;
  } catch (err) {
    // YARIM KALMASIN: yetim kullanıcı/işletme bırakmaktansa hepsini geri al.
    try {
      if (businessId) await demoPaneliSil(agentId);
      await prisma.user.deleteMany({
        where: {
          role: { in: ["CLEANER", "DRIVER"] },
          phone: { in: [ownerTel, sofor1Tel, sofor2Tel] },
        },
      });
    } catch {
      // Temizlik de patlarsa asıl hatayı gizleme.
    }
    throw err;
  }
}
