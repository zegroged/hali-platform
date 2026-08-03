import type { BadgeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// HAK EDİLEN ROZETLER (2026-08-03, işletme sahibinin kararı: "A")
//
// ÖNCESİ NEYDİ: rozetler okuma anında türetiliyordu ve ölçtükleri şey gerçek
// performans değildi —
//   • "Hızlı Teslim" = işletmenin profiline YAZDIĞI tahmini teslim süresi
//     ≤2 gün. Yani kendi beyanı; kimse doğrulamıyordu.
//   • "Çok Tercih Edilen" = 20 yorum şartı → platformda 0 yorum var, kimse
//     alamıyordu.
//   • "Doğrulanmış" = admin/destek panelinden açılan HER işletmeye otomatik
//     veriliyordu; görünür işletmelerin neredeyse tamamı öyle açıldığı için
//     rozet hiçbir şeyi ayırt etmiyordu.
// Sonuç: rozet alanı doluydu ama hiçbir bilgi taşımıyordu.
//
// ŞİMDİ: dört rozet GECE, GERÇEK VERİDEN hesaplanır ve her birinin yanında
// NEDEN hak edildiği yazar. Satın alınamaz, beyan edilemez, admin dağıtamaz.
// Şart sağlanmıyorsa rozet SİLİNİR — kazanılmış hak değil, güncel durumdur.
//
// ⚠️ Elle verilen rozetlere (VERIFIED) bu hesap DOKUNMAZ: o bir güven
// beyanıdır, performans ölçümü değil (earned=false ile ayrılır).

/** Hesaplanan rozetler — elle verilenler bu kümenin DIŞINDA. */
export const HESAPLANAN_ROZETLER: BadgeType[] = [
  "FAST_RESPONDER", // Hızlı Dönüş
  "INSURED", // Fotoğraflı Kayıt
  "TOP_RATED", // Yüksek Puan
  "FAST_DELIVERY", // Zamanında Teslim
];

const GUN = 24 * 60 * 60 * 1000;
const IKI_SAAT = 2 * 60 * 60 * 1000;

/** Eşikler tek yerde — rehberlerde ve rozet açıklamalarında aynı sayılar geçer. */
export const ESIK = {
  /** Hızlı Dönüş: son 30 günde en az bu kadar sipariş + %80 iki saatte kabul */
  donusEnAzSiparis: 5,
  donusOran: 0.8,
  /** Fotoğraflı Kayıt: son N teslimin hepsinde alım+teslim fotoğrafı */
  fotoSonTeslim: 10,
  /** Yüksek Puan: en az N yorum ve ortalama */
  puanEnAzYorum: 5,
  puanOrtalama: 4.5,
  /** Zamanında Teslim: son N teslimin en az %90'ı söz verilen sürede */
  zamanSonTeslim: 10,
  zamanOran: 0.9,
} as const;

type Sonuc = { type: BadgeType; note: string };

/** Tek işletmenin hak ettiği rozetleri ve gerekçelerini hesaplar. */
export async function isletmeRozetleri(businessId: string): Promise<Sonuc[]> {
  const simdi = Date.now();
  const otuzGun = new Date(simdi - 30 * GUN);
  const sonuc: Sonuc[] = [];

  // ---- 1) HIZLI DÖNÜŞ: son 30 günde kaç sipariş 2 saat içinde kabul edildi
  // Kabul anı OrderEvent'ten okunur (Order'da acceptedAt alanı yok).
  // Panelden elle açılan kayıtlar (isManual) SAYILMAZ: onları zaten halıcının
  // kendisi giriyor, "dönüş hızı" ölçüsü değiller.
  const siparisler = await prisma.order.findMany({
    where: {
      businessId,
      isManual: false,
      createdAt: { gte: otuzGun },
      status: { notIn: ["CANCELED"] },
    },
    select: { id: true, createdAt: true },
  });
  if (siparisler.length >= ESIK.donusEnAzSiparis) {
    const kabuller = await prisma.orderEvent.findMany({
      where: { orderId: { in: siparisler.map((o) => o.id) }, status: "ACCEPTED" },
      select: { orderId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const ilkKabul = new Map<string, Date>();
    for (const e of kabuller) if (!ilkKabul.has(e.orderId)) ilkKabul.set(e.orderId, e.createdAt);
    const hizli = siparisler.filter((o) => {
      const k = ilkKabul.get(o.id);
      return k != null && k.getTime() - o.createdAt.getTime() <= IKI_SAAT;
    }).length;
    if (hizli / siparisler.length >= ESIK.donusOran) {
      sonuc.push({
        type: "FAST_RESPONDER",
        note: `Son 30 günde gelen ${siparisler.length} siparişin ${hizli} tanesi 2 saat içinde kabul edildi.`,
      });
    }
  }

  // ---- 2) FOTOĞRAFLI KAYIT: son teslimlerin hepsinde alım + teslim fotoğrafı
  const teslimler = await prisma.order.findMany({
    where: { businessId, status: "DELIVERED" },
    orderBy: { deliveredAt: "desc" },
    take: ESIK.fotoSonTeslim,
    select: {
      pickupPhotoUrl: true,
      deliveryPhotoUrl: true,
      estimatedDays: true,
      createdAt: true,
      deliveredAt: true,
    },
  });
  if (teslimler.length >= ESIK.fotoSonTeslim) {
    const tam = teslimler.filter((o) => o.pickupPhotoUrl && o.deliveryPhotoUrl).length;
    if (tam === teslimler.length) {
      sonuc.push({
        type: "INSURED",
        note: `Son ${teslimler.length} teslimin hepsinde alım ve teslim fotoğrafı çekildi.`,
      });
    }
  }

  // ---- 3) YÜKSEK PUAN
  const b = await prisma.cleanerBusiness.findUnique({
    where: { id: businessId },
    select: { ratingAvg: true, ratingCount: true },
  });
  if (
    b &&
    b.ratingCount >= ESIK.puanEnAzYorum &&
    b.ratingAvg >= ESIK.puanOrtalama
  ) {
    sonuc.push({
      type: "TOP_RATED",
      note: `${b.ratingCount} müşteri değerlendirdi, ortalama ${b.ratingAvg.toFixed(1)} yıldız.`,
    });
  }

  // ---- 4) ZAMANINDA TESLİM: söz verilen gün sayısı içinde teslim
  // estimatedDays sipariş anında halıcının verdiği SÖZ; ölçü, sözün tutulması.
  const sozluler = teslimler.filter(
    (o) => o.estimatedDays != null && o.deliveredAt != null,
  );
  if (sozluler.length >= ESIK.zamanSonTeslim) {
    const zamaninda = sozluler.filter((o) => {
      const gecen = (o.deliveredAt!.getTime() - o.createdAt.getTime()) / GUN;
      return gecen <= o.estimatedDays! + 0.5; // yarım gün tolerans
    }).length;
    if (zamaninda / sozluler.length >= ESIK.zamanOran) {
      sonuc.push({
        type: "FAST_DELIVERY",
        note: `Son ${sozluler.length} teslimin ${zamaninda} tanesi söz verilen sürede tamamlandı.`,
      });
    }
  }

  return sonuc;
}

/**
 * TÜM işletmelerin hak edilen rozetlerini yeniden hesaplar (gece tik).
 * Hak edilmeyen ESKİ hesaplanmış rozetler SİLİNİR — rozet güncel durumu
 * gösterir, geçmişte kazanılmış bir madalya değildir.
 */
export async function rozetleriYenidenHesapla(): Promise<{
  isletme: number;
  verilen: number;
  kaldirilan: number;
}> {
  const isletmeler = await prisma.cleanerBusiness.findMany({
    where: { isDemo: false },
    select: { id: true },
  });
  let verilen = 0;
  let kaldirilan = 0;

  for (const { id } of isletmeler) {
    try {
      const hakedilen = await isletmeRozetleri(id);
      const tipler = hakedilen.map((h) => h.type);

      // Artık hak edilmeyen HESAPLANMIŞ rozetleri kaldır (elle verilene dokunma).
      const silinen = await prisma.badge.deleteMany({
        where: {
          businessId: id,
          earned: true,
          type: { in: HESAPLANAN_ROZETLER.filter((t) => !tipler.includes(t)) },
        },
      });
      kaldirilan += silinen.count;

      for (const h of hakedilen) {
        // Elle verilmiş aynı tipte rozet varsa üzerine YAZMA (VERIFIED gibi bir
        // güven beyanını hesap ezmemeli); yalnız earned kaydını tazele.
        const mevcut = await prisma.badge.findUnique({
          where: { businessId_type: { businessId: id, type: h.type } },
          select: { earned: true },
        });
        if (mevcut && !mevcut.earned) continue;
        await prisma.badge.upsert({
          where: { businessId_type: { businessId: id, type: h.type } },
          create: { businessId: id, type: h.type, note: h.note, earned: true },
          update: { note: h.note, earned: true },
        });
        verilen++;
      }
    } catch (e) {
      console.error("[rozet] hesaplanamadı:", id, e);
    }
  }
  return { isletme: isletmeler.length, verilen, kaldirilan };
}
