"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { CONTRACT_VERSION } from "@/lib/legal";

/**
 * Aracılık sözleşmesini SÜRÜMLÜ onaylar: onay anı + o an yürürlükteki metin
 * sürümü birlikte kaydedilir.
 * - ETAHS Yön. md.11/2-c: sözleşmenin elektronik ortamda, hangi sürümüyle
 *   onaylandığının işletme kaydında saklanması (ispat).
 * - ETAHS Yön. Geçici md.1/2 + md.16: sözleşme güncellenince mevcut kayıtlı
 *   işletmelerden yeni sürüm için yeniden onay alınması.
 */
export async function acceptContractVersioned() {
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");
  await prisma.cleanerBusiness.update({
    where: { id: b.id },
    data: {
      contractAcceptedAt: new Date(),
      contractVersion: CONTRACT_VERSION,
    },
  });
  revalidatePath("/panel");
}
