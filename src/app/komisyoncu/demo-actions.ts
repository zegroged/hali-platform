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

  // ÇİFT TIK KİLİDİ (2026-07-30, 4.43 bulgusu; düşman denetimiyle CAS'e
  // sıkılaştırıldı): yukarıdaki kontrol ile kurulum arasında yarış penceresi
  // var — çift tıkta iki istek de "yok" görüp iki demo kurabiliyordu
  // (PendingButton 10 sn'de sayfayı otomatik yenilediği için ikinci tık
  // gerçekçi). AppState.key birincil anahtar: createMany+skipDuplicates
  // atomiktir, kilidi yalnız İLK istek alır. Değer = bu isteğin DAMGASI:
  //  - devralma updateMany({key, value: eskiDeğer}) ile CAS — iki istek aynı
  //    anda devralamaz (denetim: düz update ikisini de geçiriyordu);
  //  - bırakma deleteMany({key, value: damga}) ile — başka isteğin devraldığı
  //    kilidi yanlışlıkla silemeyiz.
  const KILIT = `demo-kur-${agent.id}`;
  const damga = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const { count } = await prisma.appState.createMany({
    data: [{ key: KILIT, value: damga }],
    skipDuplicates: true,
  });
  if (count === 0) {
    // Kilit başkasında: ya çift tıkın ikinci isteği ya da yarım kalmış eski
    // kurulum (5 dk'dan eskiyse devral — süreç ölmüş demektir).
    const eski = await prisma.appState.findUnique({ where: { key: KILIT } });
    const yas = eski ? Date.now() - Number(eski.value.split(":")[0]) : Infinity;
    if (!eski || yas < 5 * 60 * 1000) {
      redirect("/komisyoncu?demo=var"); // ilk istek kurmakta — sayfa yenilenince görünür
    }
    const devral = await prisma.appState.updateMany({
      where: { key: KILIT, value: eski.value },
      data: { value: damga },
    });
    if (devral.count === 0) {
      redirect("/komisyoncu?demo=var"); // devralmayı eşzamanlı başka istek kazandı
    }
  }
  try {
    await demoPaneliKur(agent.id);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect istisnası
    console.error("[demo-panel] kurulum hatası:", e);
    hata("Demo panel kurulamadı — tekrar dene, sürerse yöneticiye bildir.");
  } finally {
    await prisma.appState
      .deleteMany({ where: { key: KILIT, value: damga } })
      .catch(() => {});
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
