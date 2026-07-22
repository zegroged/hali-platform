"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { uretKodMetni } from "@/lib/referralCode";

// Komisyoncunun TEK yetkili aksiyonu: kendi adına tek kullanımlık kod üretmek.
// Her müşteri için ayrı kod üretilir; kod bir işletmeye bağlanınca yanar.
export async function generateReferralCode() {
  const u = await getSessionUser();
  if (!u || u.role !== "AGENT") redirect("/giris");

  const agent = await prisma.agent.findUnique({
    where: { userId: u.id },
    select: { id: true, active: true },
  });
  if (!agent) redirect("/giris");
  if (!agent.active) {
    redirect(
      "/komisyoncu?hata=" +
        encodeURIComponent("Hesabın pasif — kod üretmek için yöneticiyle görüş."),
    );
  }

  // Spam freni: aynı anda en fazla 25 kullanılmamış kod.
  const bekleyen = await prisma.agentReferralCode.count({
    where: { agentId: agent.id, usedAt: null },
  });
  if (bekleyen >= 25) {
    redirect(
      "/komisyoncu?hata=" +
        encodeURIComponent(
          "25 kullanılmamış kodun var — önce onları kullan (her kod tek müşteri içindir).",
        ),
    );
  }

  // Benzersiz kod üret (çakışmada birkaç deneme).
  for (let i = 0; i < 10; i++) {
    const kod = uretKodMetni();
    try {
      await prisma.agentReferralCode.create({
        data: { agentId: agent.id, code: kod },
      });
      revalidatePath("/komisyoncu");
      redirect("/komisyoncu?yeni=" + encodeURIComponent(kod));
    } catch (e) {
      // redirect() bir istisnadır — yutma, dışarı fırlat (Next yönlendirir).
      if (e && typeof e === "object" && "digest" in e) throw e;
      // P2002 (kod çakışması) → yeni kod dene; başka hata → fırlat.
      if (
        !(
          e &&
          typeof e === "object" &&
          "code" in e &&
          (e as { code?: string }).code === "P2002"
        )
      ) {
        throw e;
      }
    }
  }
  redirect(
    "/komisyoncu?hata=" + encodeURIComponent("Kod üretilemedi — tekrar dene."),
  );
}
