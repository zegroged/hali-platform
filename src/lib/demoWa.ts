import { prisma } from "@/lib/prisma";
import { normalizePhone, isRealMobilePhone } from "@/lib/phone";
import { waNumber } from "@/lib/whatsapp";

// DEMO WHATSAPP BAĞI (2026-08-04, işletme sahibi isteği).
//
// SORUN: komisyoncu dükkânda demo yaparken WhatsApp'ı GÖSTEREMİYORDU. Demo
// siparişlerin müşteri numaraları uydurmadır (0500 — Türkiye'de tahsis
// edilmemiş mobil kod) ve `waGonderVeKaydet` demo işletmede gönderimi tamamen
// durdurur. Yani panelde "Mesajlar" ekranı örnek yazışmayı gösteriyordu ama
// karşıdaki halıcı KENDİ telefonunda hiçbir şey görmüyordu — ürünün en güçlü
// özelliği sözde kalıyordu.
//
// ÇÖZÜM: komisyoncu, karşısındaki halıcının GERÇEK numarasını demoya bağlar.
// Bağlıyken demo siparişlerinin müşteri numarası o numaradır; dolayısıyla
// mevcut akışın TAMAMI (şablon gönderimi, gelen mesajın eşleşmesi, 24 saatlik
// pencere, panelde cevap kutusu) hiçbir özel durum olmadan çalışır. Halıcı
// kendi telefonunda "halınız teslim alındı / yıkama başladı / yolda" mesajını
// görür, cevap yazar, cevabı panelde belirir.
//
// 🔴 NEDEN AYRI BİR BAĞ, "demoyu tamamen aç" DEĞİL:
//  1. Bağ SÜRELİDİR (24 saat) ve kendiliğinden çözülür — demo bittikten sonra
//     o kişiye bir daha mesaj gitmez.
//  2. Bağ yalnız YAZILAN numaraya izin verir; uydurma 0500 numaralarına
//     gönderim hâlâ kapalıdır (kota ve panel gürültüsü koruması).
//  3. Numara BAŞKA bir gerçek işletmenin son 30 günlük müşterisiyse bağ
//     KURULMAZ — yoksa webhook'un eşleştirmesi o kişinin gerçek mesajlarını
//     demo paneline düşürür, sonra da "yönlendirme değişimi" kapanı yüzünden
//     mesajları sahipsiz bırakırdı (bkz. api/whatsapp/webhook).
//  4. Bağ çözülürken demo sırasında oluşan GERÇEK mesaj satırları SİLİNİR;
//     numaranın üstünde "bu numara şu işletmeye bağlıydı" izi kalmaz.
//
// ⚠️ Bu numaradan gönderilen her mesaj Meta'nın kalite puanına yazılır.
// Karşındaki kişi "engelle/şikâyet et" derse numaranın itibarı düşer — ve bu
// numara işletme sahibinin KİŞİSEL numarasıdır, yedeği yoktur. Bu yüzden bağ
// yalnız elle, yüz yüze, günlük sayıda sınırlıdır.

const SAAT_MS = 60 * 60 * 1000;

/** Bağ ne kadar sürer — demo bitince kimse elle kaldırmasa da kendiliğinden düşer. */
export const DEMO_WA_SURE_SAAT = 24;

/** Bir komisyoncu günde en fazla kaç farklı numaraya demo bağlayabilir. */
const GUNLUK_BAG_SINIRI = 5;

/** Bağın "aktif sayıldığı" sipariş durumları — komisyoncunun ilerletebildikleri. */
const AKTIF_DURUMLAR = [
  "CREATED",
  "ACCEPTED",
  "PICKED_UP",
  "WASHING",
  "OUT_FOR_DELIVERY",
] as const;

type Bag = {
  /** Bağlanan gerçek numara, 0XXXXXXXXXX biçiminde. */
  phone: string;
  /** Meta biçimi (905…) — mesaj satırlarında bu tutulur. */
  waPhone: string;
  /** ISO; bu andan sonra bağ yok sayılır. */
  until: string;
  agentId: string | null;
  /** Bağlanmadan önceki hâli — çözerken birebir geri yazılır. */
  orders: { id: string; phone: string }[];
  /** Örnek yazışmanın (waId `demo-…`) eski numarası. */
  eskiWaPhone: string | null;
};

const anahtar = (businessId: string) => `demo-wa-${businessId}`;
const gunAnahtari = (agentId: string) =>
  `demo-wa-sayac-${agentId}-${new Date().toISOString().slice(0, 10)}`;

/** Kayıtlı bağı oku. Süresi dolmuşsa null döner (temizliği çağıran yapar). */
async function bagiOku(businessId: string): Promise<Bag | null> {
  const k = await prisma.appState.findUnique({ where: { key: anahtar(businessId) } });
  if (!k) return null;
  try {
    const b = JSON.parse(k.value) as Bag;
    if (!b?.phone || !b?.until) return null;
    return b;
  } catch {
    return null;
  }
}

/** Süresi dolmamış bağ (yoksa/dolmuşsa null). */
export async function demoWaOku(
  businessId: string,
): Promise<{ phone: string; until: Date } | null> {
  const b = await bagiOku(businessId);
  if (!b) return null;
  const until = new Date(b.until);
  if (!(until.getTime() > Date.now())) return null;
  return { phone: b.phone, until };
}

/**
 * Bu demo işletmede, bu numaraya GERÇEK gönderim serbest mi?
 * `waGonderVeKaydet` ve panel cevap ucu bunu sorar. Numara karşılaştırması
 * biçimden bağımsızdır (0532…, 90532…, +90532… hepsi aynı sayılır).
 */
export async function demoWaGecerliMi(
  businessId: string,
  phone: string | null | undefined,
): Promise<boolean> {
  const bag = await demoWaOku(businessId);
  if (!bag || !phone) return false;
  const son10 = (p: string) => p.replace(/\D/g, "").slice(-10);
  return son10(bag.phone) === son10(phone) && son10(phone).length === 10;
}

/** Bugün bu komisyoncu kaç farklı numara bağlamış? */
async function gunlukSayac(agentId: string): Promise<number> {
  const k = await prisma.appState.findUnique({ where: { key: gunAnahtari(agentId) } });
  return Number(k?.value ?? 0);
}

export type BaglaSonuc = { ok: true; phone: string; until: Date } | { ok: false; hata: string };

/**
 * Demo panelini gerçek bir numaraya bağla.
 * Aktif demo siparişlerinin müşteri numarası bu numara yapılır; örnek yazışma
 * da aynı numaraya taşınır ki sohbet ekranı kopuk görünmesin.
 */
export async function demoWaBagla(
  businessId: string,
  ham: string,
): Promise<BaglaSonuc> {
  const isletme = await prisma.cleanerBusiness.findUnique({
    where: { id: businessId },
    select: { id: true, isDemo: true, referredByAgentId: true },
  });
  // 🔴 GERÇEK İŞLETMEDE ASLA: bu fonksiyon sipariş numarasını DEĞİŞTİRİYOR.
  if (!isletme?.isDemo)
    return { ok: false, hata: "Bu işlem yalnız demo panelinde yapılabilir." };

  const tel = normalizePhone(ham);
  if (!isRealMobilePhone(tel))
    return {
      ok: false,
      hata: "Geçerli bir Türkiye cep numarası yaz (örn. 0532 111 22 33).",
    };

  // Platformun KENDİ WhatsApp numarası: Meta kendi numarasına gönderime izin
  // vermez (400 Invalid parameter) — bağ kurulsa demo sessizce çalışmazdı.
  const kendi = process.env.WHATSAPP_SELF_PHONE;
  if (kendi && normalizePhone(kendi) === tel)
    return {
      ok: false,
      hata: "Bu numara platformun kendi WhatsApp numarası — kendine mesaj gönderemez.",
    };

  // 🔴 GERÇEK MÜŞTERİYİ ÇALMA: bu numaranın son 30 günde demo DIŞI bir siparişi
  // varsa bağ kurulmaz. Kurulsaydı webhook gelen mesajı en yeni siparişe (yani
  // demoya) bağlar, gerçek halıcı müşterisinin mesajını göremezdi.
  const OTUZ_GUN = new Date(Date.now() - 30 * 24 * SAAT_MS);
  const gercekSiparis = await prisma.order.findFirst({
    where: {
      customerPhone: { in: [tel, tel.slice(1), "90" + tel.slice(1), "+90" + tel.slice(1)] },
      createdAt: { gte: OTUZ_GUN },
      status: { notIn: ["CANCELED", "REJECTED"] },
      business: { isDemo: false },
    },
    select: { id: true },
  });
  if (gercekSiparis)
    return {
      ok: false,
      hata:
        "Bu numaranın son 30 günde gerçek bir siparişi var. Demoya bağlanamaz — o müşterinin mesajları yanlış panele düşerdi.",
    };

  const agentId = isletme.referredByAgentId;
  if (agentId) {
    const sayac = await gunlukSayac(agentId);
    const mevcut = await demoWaOku(businessId);
    // Aynı numarayı tazelemek sayaçtan yemez; YENİ numara yer.
    const ayniNumara = mevcut && normalizePhone(mevcut.phone) === tel;
    if (!ayniNumara && sayac >= GUNLUK_BAG_SINIRI)
      return {
        ok: false,
        hata: `Bugün ${GUNLUK_BAG_SINIRI} farklı numaraya demo gösterdin. Yarın devam edebilirsin.`,
      };
  }

  // Önceki bağ varsa ÖNCE çöz — yoksa "eski numara" bilgisi kaybolur ve
  // siparişler bir daha uydurma numaralarına dönemez.
  if (await bagiOku(businessId)) await demoWaCoz(businessId);

  const yeniWa = waNumber(tel);
  if (!yeniWa) return { ok: false, hata: "Numara WhatsApp biçimine çevrilemedi." };

  const siparisler = await prisma.order.findMany({
    where: { businessId, status: { in: [...AKTIF_DURUMLAR] } },
    select: { id: true, customerPhone: true },
  });
  if (siparisler.length === 0)
    return {
      ok: false,
      hata: "Demoda açık sipariş yok. Admin panelinden 'Demoyu yenile' de, sonra tekrar dene.",
    };

  // Örnek yazışmanın eski numarası (çözerken geri yazılacak).
  const ornek = await prisma.whatsAppMessage.findFirst({
    where: { businessId, waId: { startsWith: "demo-" } },
    select: { phone: true },
  });

  const until = new Date(Date.now() + DEMO_WA_SURE_SAAT * SAAT_MS);
  const bag: Bag = {
    phone: tel,
    waPhone: yeniWa,
    until: until.toISOString(),
    agentId,
    orders: siparisler.map((o) => ({ id: o.id, phone: o.customerPhone })),
    eskiWaPhone: ornek?.phone ?? null,
  };

  await prisma.$transaction([
    prisma.order.updateMany({
      where: { id: { in: siparisler.map((o) => o.id) } },
      data: { customerPhone: tel },
    }),
    // Örnek yazışma da yeni numaraya taşınsın: aksi hâlde sohbet listesinde
    // biri uydurma numarada, yenileri gerçek numarada iki ayrı sohbet olurdu.
    prisma.whatsAppMessage.updateMany({
      where: { businessId, waId: { startsWith: "demo-" } },
      data: { phone: yeniWa },
    }),
    prisma.appState.upsert({
      where: { key: anahtar(businessId) },
      create: { key: anahtar(businessId), value: JSON.stringify(bag) },
      update: { value: JSON.stringify(bag) },
    }),
  ]);

  if (agentId) {
    const k = gunAnahtari(agentId);
    await prisma.$executeRaw`
      INSERT INTO "AppState" ("key", "value", "updatedAt")
      VALUES (${k}, '1', now())
      ON CONFLICT ("key") DO UPDATE
        SET "value" = (COALESCE("AppState"."value", '0')::int + 1)::text,
            "updatedAt" = now()`;
  }

  return { ok: true, phone: tel, until };
}

/**
 * Bağı çöz: siparişler uydurma numaralarına döner, örnek yazışma eski numarasına
 * geri taşınır, demo sırasında oluşan GERÇEK mesaj satırları silinir.
 * Numaranın üstünde "şu işletmeye bağlıydı" izi bırakmamak önemlidir — o iz
 * kalırsa kişi ileride gerçek bir halıcıya müşteri olduğunda webhook'un
 * kaçırma savunması mesajlarını sahipsiz bırakır.
 */
export async function demoWaCoz(businessId: string): Promise<boolean> {
  const bag = await bagiOku(businessId);
  if (!bag) return false;

  await prisma.$transaction([
    ...bag.orders.map((o) =>
      prisma.order.updateMany({
        where: { id: o.id, businessId },
        data: { customerPhone: o.phone },
      }),
    ),
    // Demo sırasında GERÇEKTEN gidip gelen mesajlar (waId Meta'dan gelir).
    prisma.whatsAppMessage.deleteMany({
      where: { businessId, phone: bag.waPhone, waId: { not: { startsWith: "demo-" } } },
    }),
    prisma.whatsAppMessage.updateMany({
      where: { businessId, waId: { startsWith: "demo-" } },
      data: { phone: bag.eskiWaPhone ?? bag.waPhone },
    }),
    prisma.appState.deleteMany({ where: { key: anahtar(businessId) } }),
  ]);
  return true;
}

/** Süresi dolmuş bağı temizle (demo paneli her açıldığında çağrılır). */
export async function demoWaSuresiDolduysaCoz(businessId: string): Promise<void> {
  const bag = await bagiOku(businessId);
  if (!bag) return;
  if (new Date(bag.until).getTime() > Date.now()) return;
  await demoWaCoz(businessId);
}
