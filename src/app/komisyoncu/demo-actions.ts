"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  createSession,
  mevcutOturumJetonu,
  demoBiletiYaz,
  demoBiletiKullan,
} from "@/lib/auth";
import {
  demoPaneliKur,
  demoPaneliSil,
  demoKullaniciAdi,
} from "@/lib/demoPanel";

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

// ---------------------------------------------------------- TEK TIK DEMO GİRİŞİ
//
// DERT (2026-08-02, kullanıcı): komisyoncu dükkânda demo göstermek için
// telefonda kullanıcı adı + şifre yazmaya uğraşıyor, halıcının önünde vakit
// kaybediyor.
//
// ÇÖZÜM: tek düğme. Oturum, komisyoncunun KENDİ demo işletmesinin sahibine
// çevrilir; dönüş için eski oturum jetonu ayrı çerezde (bilet) saklanır ve
// panelin üstünde "Komisyoncu paneline dön" şeridi çıkar.
//
// 🔴 GÜVENLİK SINIRLARI (bilerek dar):
//  - Yalnız AGENT rolü çağırabilir.
//  - Hedef, `isDemo: true` VE `referredByAgentId = kendi id'si` olan işletmenin
//    sahibidir; kimlik DIŞARIDAN ALINMAZ, sorguyla bulunur → başka bir
//    işletmeye geçiş imkânsız (bu bir "impersonation" ucu DEĞİLDİR).
//  - Dönüşte rol yeniden okunur: bilet yalnız AGENT hesabına dönüş açar,
//    banlı hesaba dönmez.
async function demoOturumuAc(hedef: "isletme" | "sofor") {
  const agent = await requireAgent();
  // Pasif/dondurulmuş komisyoncu satış yapmıyor — demoya da geçemez.
  if (!agent.active || agent.suspendedByAdmin)
    hata("Hesabın pasif — demo panele giriş için yöneticiyle görüş.");
  const demo = await prisma.cleanerBusiness.findFirst({
    where: { isDemo: true, referredByAgentId: agent.id },
    select: {
      ownerId: true,
      // Şoför hedefi: panelde gösterilen "demo.sofor1.*" hesabı; bulunamazsa
      // (eski demo, elle silinmiş şoför) ilk şoföre düşülür.
      drivers: {
        select: { userId: true, user: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!demo) hata("Önce demo panelini oluştur, sonra tek tıkla girebilirsin.");
  let hedefUserId = demo!.ownerId;
  if (hedef === "sofor") {
    const beklenen = demoKullaniciAdi(agent.id, "sofor1");
    const sofor =
      demo!.drivers.find((d) => d.user.username === beklenen) ?? demo!.drivers[0];
    if (!sofor)
      hata("Demo panelinde şoför bulunamadı — demoyu sıfırlayıp tekrar dene.");
    hedefUserId = sofor!.userId;
  }
  // SIRA ÖNEMLİ: createSession bileti siler (bkz. auth.ts), o yüzden bilet
  // ondan SONRA bırakılır. Bırakılan jeton komisyoncunun kendi oturumudur —
  // demoBiletiBirak bunu createSession'dan önce okumalı, aşağıda saklıyoruz.
  const kendiJeton = await mevcutOturumJetonu();
  await createSession(hedefUserId);
  if (kendiJeton) await demoBiletiYaz(kendiJeton);
  redirect(hedef === "sofor" ? "/sofor" : "/panel");
}

/** Demo İŞLETME paneline tek tıkla gir. */
export async function demoyaGec() {
  await demoOturumuAc("isletme");
}

/** Demo ŞOFÖR ekranına tek tıkla gir (halıcıya şoför akışını göstermek için). */
export async function demoSoforaGec() {
  await demoOturumuAc("sofor");
}

/** Demo panelinden komisyoncu paneline dön (bileti tüketir). */
export async function demodanDon() {
  const agentUserId = await demoBiletiKullan();
  if (!agentUserId) redirect("/giris");
  const sahip = await prisma.user.findUnique({
    where: { id: agentUserId },
    select: { id: true, role: true, bannedAt: true },
  });
  if (!sahip || sahip.role !== "AGENT" || sahip.bannedAt) redirect("/giris");
  await createSession(sahip.id);
  redirect("/komisyoncu");
}
