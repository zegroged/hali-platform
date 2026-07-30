"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { demoPaneliKur, demoPaneliSil } from "@/lib/demoPanel";

// KOMİSYONCU DEMO PANELİ — aksiyonlar (2026-07-30).
// Komisyoncu dükkânda ürünü gösterebilsin diye kendi adına, gerçekçi veriyle
// dolu bir işletme hesabı açar/sıfırlar. İzolasyon kuralları ve tohumlama
// ayrıntısı için bkz. lib/demoPanel.ts.

/** Oturumdaki komisyoncuyu getir — YETKİ KAPISI prisma'dan ÖNCE. */
async function requireAgent() {
  const u = await getSessionUser();
  if (!u || u.role !== "AGENT") redirect("/giris");
  const agent = await prisma.agent.findUnique({
    where: { userId: u.id },
    select: { id: true, active: true, suspendedByAdmin: true },
  });
  if (!agent) redirect("/giris");
  return agent;
}

const hata = (m: string) => {
  redirect("/komisyoncu?hata=" + encodeURIComponent(m));
};

/** "Demo panelimi oluştur" — hesap yoksa kurar, varsa dokunmaz. */
export async function createDemoPanel() {
  const agent = await requireAgent();
  // Pasif/dondurulmuş komisyoncu yeni hesap AÇAMAZ (kod üretimiyle aynı kural).
  if (!agent.active || agent.suspendedByAdmin) {
    hata("Hesabın pasif — demo panel açmak için yöneticiyle görüş.");
  }

  const varOlan = await prisma.cleanerBusiness.findFirst({
    where: { isDemo: true, referredByAgentId: agent.id },
    select: { id: true },
  });
  if (varOlan) {
    revalidatePath("/komisyoncu");
    redirect("/komisyoncu?demo=var");
  }

  try {
    await demoPaneliKur(agent.id);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect istisnası
    console.error("[demo-panel] kurulum hatası:", e);
    hata("Demo panel kurulamadı — tekrar dene, sürerse yöneticiye bildir.");
  }
  revalidatePath("/komisyoncu");
  redirect("/komisyoncu?demo=kuruldu");
}

/** "Sıfırla" — demo verisini siler ve yeniden tohumlar (giriş bilgisi aynı kalır). */
export async function resetDemoPanel() {
  const agent = await requireAgent();
  if (!agent.active || agent.suspendedByAdmin) {
    hata("Hesabın pasif — demo panel sıfırlanamaz, yöneticiyle görüş.");
  }
  try {
    await demoPaneliSil(agent.id);
    await demoPaneliKur(agent.id);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[demo-panel] sıfırlama hatası:", e);
    hata("Demo panel sıfırlanamadı — tekrar dene, sürerse yöneticiye bildir.");
  }
  revalidatePath("/komisyoncu");
  redirect("/komisyoncu?demo=sifirlandi");
}

/** "Demo panelimi sil" — hesabı ve tüm sahte verisini kaldırır. */
export async function deleteDemoPanel() {
  const agent = await requireAgent();
  try {
    await demoPaneliSil(agent.id);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[demo-panel] silme hatası:", e);
    hata("Demo panel silinemedi — tekrar dene.");
  }
  revalidatePath("/komisyoncu");
  redirect("/komisyoncu?demo=silindi");
}
