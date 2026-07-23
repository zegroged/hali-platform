import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { activeSubscriptionWhere } from "@/lib/subscription";

// Ana sayfa/arama hızlı butonları: sabit semt listesi yerine GERÇEKTEN yayında
// işletmesi olan iller, işletme sayısına göre (2026-07-23 kullanıcı kararı —
// ziyaretçiyi arzın OLDUĞU yere yönlendir; yeni il açılınca buton kendiliğinden
// gelir). 10 dakikalık önbellek: her sayfa görüntülemede sorgu atılmaz.
export const getSupplyCities = unstable_cache(
  async (): Promise<string[]> => {
    const gruplar = await prisma.cleanerBusiness.groupBy({
      by: ["city"],
      where: {
        isVisible: true,
        city: { not: "" },
        // Test kaydı bir ile buton kazandırmasın (vitrin kararı ayrı konu).
        NOT: { name: { contains: "(Test)" } },
        subscription: { is: activeSubscriptionWhere() },
      },
      _count: { city: true },
      orderBy: { _count: { city: "desc" } },
      take: 6,
    });
    return gruplar.map((g) => g.city);
  },
  ["supply-cities"],
  { revalidate: 600 },
);
