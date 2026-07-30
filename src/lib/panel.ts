import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { notifyCityLeadsIfOpen } from "@/lib/cityLeads";

export async function getCurrentBusiness() {
  const u = await getSessionUser();
  if (!u || u.role !== "CLEANER") return null;
  return prisma.cleanerBusiness.findUnique({
    where: { ownerId: u.id },
    include: {
      owner: {
        select: {
          name: true,
          phoneVerified: true,
          emailVerified: true,
          phone: true,
          email: true,
        },
      },
      subscription: true,
      badges: true,
      drivers: {
        include: {
          // username: şoförün giriş kimliği — halıcı panelde görüp iletir.
          user: { select: { name: true, phone: true, username: true } },
        },
      },
      pricing: { orderBy: { createdAt: "asc" } },
      serviceAreas: true,
      photos: true,
    },
  });
}

export type CurrentBusiness = NonNullable<
  Awaited<ReturnType<typeof getCurrentBusiness>>
>;

// Yapısal tip — hem getCurrentBusiness sonucu hem admin onayındaki include uyar.
type ProfileCheckable = {
  taxNumber: string | null;
  deliveryEstimateMinDays: number | null;
  deliveryEstimateMaxDays: number | null;
  workingHours: unknown;
  serviceAreas: unknown[];
  pricing: { isAddon: boolean }[];
  photos: unknown[];
};

// İL/İLÇE YOKSA İŞLETME HİÇBİR YERDE LİSTELENMEZ (2026-07-30 düzeltmesi).
// Admin/destek yeni işletme açarken hiçbir alan zorunlu değildir (bilinçli
// karar) — ama il/ilçesi boş kalan kayıt keşif, şehir/ilçe sayfaları ve
// sitemap sorgularının hiçbirine düşmez. Bu kayıtlar "Görünür ✓" işaretiyle
// duruyordu; admin işletmeyi yayında sanıyor, işletme sahibi ise hiç müşteri
// alamıyordu. Artık yayın dışı sayılır — sahibi panel profilinden (ya da admin)
// il/ilçe seçtiği an syncVisibility onu kendiliğinden yayına alır.
export function konumEksik(b: { city: string; district: string }): boolean {
  return !b.city.trim() || !b.district.trim();
}

// Görünürlüğü mevcut duruma göre senkronla — OTOMATİK YAYIN (2026-07-08):
// profil tam + e-posta doğrulanmış + sözleşme onaylı + en az 1 şoför varsa
// işletme admin ONAYI BEKLEMEDEN görünür olur (yayında kalmak ayrıca aktif
// abonelik ister — o filtre sorgu tarafında). Admin onayı artık yalnız
// "Doğrulanmış" rozetini verir; REJECTED = yayından düşürme (kill switch).
// Fotoğraf/fiyat/bölge silinince veya e-posta değişince otomatik gizlenir.
export async function syncVisibility(businessId: string): Promise<void> {
  const b = await prisma.cleanerBusiness.findUnique({
    where: { id: businessId },
    include: {
      pricing: true,
      serviceAreas: true,
      photos: true,
      owner: { select: { emailVerified: true } },
      drivers: { select: { id: true } },
    },
  });
  if (!b) return;
  // TAM YETKİ (2026-07-13, kullanıcı kararı): admin/destek eliyle açılan
  // işletmede yayın şartı yalnız FOTOĞRAF (ad+telefon oluşturmada zaten
  // zorunlu). Profil eksikleri (fiyat, bölge, vergi, şoför, e-posta) yayına
  // engel değil — sipariş güvenliği ayrı katmanda (şoförsüz sipariş API 409).
  // Öz-servis kayıtta tam şart seti aynen sürer.
  const ok =
    !konumEksik(b) &&
    b.verification !== "REJECTED" &&
    (b.createdByAdmin
      ? b.photos.length > 0
      : profileComplete(b) &&
        b.owner.emailVerified &&
        b.contractAcceptedAt != null &&
        b.drivers.length > 0);
  if (b.isVisible !== ok) {
    await prisma.cleanerBusiness.update({
      where: { id: businessId },
      data: { isVisible: ok },
    });
  }
  // İşletme kamuya açık listeye girdiyse o şehirde bekleyen "haber ver"
  // kayıtlarına müjde maili (idempotent; hata görünürlük akışını bozmasın).
  if (ok) {
    try {
      await notifyCityLeadsIfOpen(businessId);
    } catch {}
  }
}

export function profileComplete(b: ProfileCheckable): boolean {
  const hasMain = b.pricing.some((p) => !p.isAddon);
  return Boolean(
    b.taxNumber &&
      b.deliveryEstimateMinDays &&
      b.deliveryEstimateMaxDays &&
      b.serviceAreas.length > 0 &&
      hasMain &&
      b.photos.length > 0 &&
      b.workingHours,
  );
}

// Doğrulamaya gönderebilmek için: profil tam + e-posta doğrulanmış + sözleşme onaylı
export function verificationReady(b: CurrentBusiness): boolean {
  return (
    profileComplete(b) &&
    b.owner.emailVerified &&
    b.contractAcceptedAt != null
  );
}

export function completenessChecklist(
  b: CurrentBusiness,
): { label: string; done: boolean }[] {
  return [
    { label: "Vergi numarası", done: Boolean(b.taxNumber) },
    {
      label: "Teslim süresi",
      done: Boolean(b.deliveryEstimateMinDays && b.deliveryEstimateMaxDays),
    },
    { label: "Hizmet bölgesi", done: b.serviceAreas.length > 0 },
    { label: "Fiyatlandırma", done: b.pricing.some((p) => !p.isAddon) },
    { label: "Fotoğraflar", done: b.photos.length > 0 },
    { label: "Çalışma saatleri", done: Boolean(b.workingHours) },
  ];
}
