import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function getCurrentBusiness() {
  const u = await getSessionUser();
  if (!u || u.role !== "CLEANER") return null;
  return prisma.cleanerBusiness.findUnique({
    where: { ownerId: u.id },
    include: {
      owner: {
        select: {
          phoneVerified: true,
          emailVerified: true,
          phone: true,
          email: true,
        },
      },
      subscription: true,
      badges: true,
      drivers: { include: { user: { select: { name: true, phone: true } } } },
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

// Görünürlüğü mevcut duruma göre senkronla: bir işletme müşteriye ancak
// DOĞRULANMIŞ + profil tam + e-posta doğrulanmış + en az 1 şoförü varsa görünür.
// Fotoğraf/fiyat/bölge silinince veya e-posta değişince otomatik gizlenir;
// tekrar tamamlanınca (VERIFIED ise) geri görünür olur. Admin onayını bypass etmez.
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
  const ok =
    b.verification === "VERIFIED" &&
    profileComplete(b) &&
    b.owner.emailVerified &&
    b.drivers.length > 0;
  if (b.isVisible !== ok) {
    await prisma.cleanerBusiness.update({
      where: { id: businessId },
      data: { isVisible: ok },
    });
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
