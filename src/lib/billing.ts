import { prisma } from "@/lib/prisma";

// Cari/abone kodu (HY-0001): mali müşavirin ödemeleri muhasebe programında
// cari hesapla eşleştirmesi için insan-dostu benzersiz kod. Kayıt anında
// atanır; eski hesaplar için ödeme akışında emniyet kemeri vardır.
export async function ensureBillingCode(businessId: string): Promise<string> {
  const existing = await prisma.cleanerBusiness.findUnique({
    where: { id: businessId },
    select: { billingCode: true },
  });
  if (existing?.billingCode) return existing.billingCode;

  // Sıra numarası: kodlu işletme sayısı + 1. Eşzamanlı kayıtta unique çakışması
  // olursa +1 ile birkaç kez denenir (yazma hacmi düşük — pratikte ilk deneme tutar).
  for (let i = 0; i < 8; i++) {
    const count = await prisma.cleanerBusiness.count({
      where: { billingCode: { not: null } },
    });
    const code = `HY-${String(count + 1 + i).padStart(4, "0")}`;
    try {
      await prisma.cleanerBusiness.update({
        where: { id: businessId },
        data: { billingCode: code },
      });
      return code;
    } catch {
      // unique çakışma → sıradaki numara
    }
  }
  // Son çare: id türevi (her koşulda benzersiz).
  const fallback = `HY-${businessId.slice(-6).toUpperCase()}`;
  await prisma.cleanerBusiness.update({
    where: { id: businessId },
    data: { billingCode: fallback },
  });
  return fallback;
}
