"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { uretKodMetni } from "@/lib/referralCode";
import { normalizePhone, isTrPhone } from "@/lib/phone";
import { normalizeUsername, validateUsername } from "@/lib/username";

// Komisyoncunun TEK yetkili aksiyonu: kendi adına tek kullanımlık kod üretmek.
// Her müşteri için ayrı kod üretilir; kod bir işletmeye bağlanınca yanar.
// PREMIUM (canDiscount) komisyoncu koda indirim gömebilir: yüzde + kaç ay.
export async function generateReferralCode(formData: FormData) {
  const u = await getSessionUser();
  if (!u || u.role !== "AGENT") redirect("/giris");

  const agent = await prisma.agent.findUnique({
    where: { userId: u.id },
    select: { id: true, active: true, canDiscount: true },
  });
  if (!agent) redirect("/giris");
  if (!agent.active) {
    redirect(
      "/komisyoncu?hata=" +
        encodeURIComponent("Hesabın pasif — kod üretmek için yöneticiyle görüş."),
    );
  }

  // Opsiyonel indirim (yalnız premium): ikisi birlikte dolu olmalı.
  const hataDon = (m: string) => {
    redirect("/komisyoncu?hata=" + encodeURIComponent(m));
  };
  const pctRaw = String(formData.get("discountPercent") || "").replace(",", ".").trim();
  const ayRaw = String(formData.get("discountMonths") || "").trim();
  let discountPercent: number | null = null;
  let discountMonths: number | null = null;
  if (pctRaw || ayRaw) {
    if (!agent.canDiscount)
      hataDon("İndirim tanımlama yetkin yok — yöneticiyle görüş.");
    const pct = Number(pctRaw);
    const ay = Number(ayRaw);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100)
      hataDon("İndirim yüzdesi 1 ile 100 arasında olmalı.");
    if (!Number.isInteger(ay) || ay < 1 || ay > 1200)
      hataDon("İndirim süresi ay olarak girilmeli (en az 1).");
    discountPercent = Math.round(pct * 100) / 100;
    discountMonths = ay;
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
        data: { agentId: agent.id, code: kod, discountPercent, discountMonths },
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

// ---- BAŞ KOMİSYONCU: alt komisyoncu yönetimi (2026-07-25) ----
// Baş komisyoncu kendi panelinden komisyoncu hesabı açar ve yüzdesini belirler
// (0 .. havuz payı). Farkı kendisi alır (bkz. lib/commission.ts). 3. KADEME YOK:
// açılan hesap isHead=false → o da hesap açamaz. İNDİRİM yetkisi, baş
// komisyoncunun KENDİ yetkisi varsa alta verilebilir (2026-07-26 kararı;
// önceki kural değişti) — sonradan da aç/kapat edilebilir.

/** Oturumdaki BAŞ komisyoncuyu getir (değilse yetkisiz). */
async function requireHeadAgent() {
  const u = await getSessionUser();
  if (!u || u.role !== "AGENT") redirect("/giris");
  const agent = await prisma.agent.findUnique({
    where: { userId: u!.id },
    select: { id: true, active: true, isHead: true, poolPercent: true, canDiscount: true },
  });
  if (!agent || !agent.isHead) redirect("/komisyoncu");
  // PASİF baş komisyoncu ekibini yönetemez (inceleme bulgusu: yalnız
  // createSubAgent kontrol ediyordu, pasife alma/aktive etme açıktaydı).
  if (!agent.active) {
    redirect(
      "/komisyoncu?hata=" +
        encodeURIComponent("Hesabın pasif — ekip yönetimi kapalı, yöneticiyle görüş."),
    );
  }
  return agent!;
}

export async function createSubAgent(formData: FormData) {
  const head = await requireHeadAgent();
  const hata = (m: string) => {
    redirect("/komisyoncu?hata=" + encodeURIComponent(m));
  };
  if (!head.active) hata("Hesabın pasif — komisyoncu açamazsın, yöneticiyle görüş.");

  const name = String(formData.get("name") || "").trim();
  const phone = normalizePhone(String(formData.get("phone") || ""));
  const username = normalizeUsername(String(formData.get("username") || "").trim());
  const password = String(formData.get("password") || "");
  const percentRaw = String(formData.get("percent") || "").replace(",", ".").trim();
  const havuz = Number(head.poolPercent ?? 0);
  // İNDİRİM YETKİSİ DEVRİ (2026-07-26 kullanıcı kararı): baş komisyoncu, açtığı
  // komisyoncuya indirim yetkisi verebilir — AMA yalnız KENDİSİNDE varsa.
  // Sahip olmadığı yetkiyi dağıtamaz (yetki yükseltme deliği olmasın).
  const altIndirim = formData.get("canDiscount") === "on" && head.canDiscount;

  if (name.length < 2) hata("Ad soyad girin.");
  if (!isTrPhone(phone)) hata("Geçerli bir telefon girin (11 hane).");
  const uErr = validateUsername(username);
  if (uErr) hata(uErr);
  if (password.length < 8) hata("Şifre en az 8 karakter olmalı.");
  const percent = Number(percentRaw);
  if (!Number.isFinite(percent) || percent < 0)
    hata("Komisyon yüzdesi 0 veya daha büyük olmalı.");
  // TAVAN: havuz payını AŞAMAZ — aşarsa platform %50'den fazla öderdi.
  if (percent > havuz)
    hata(`Bu komisyoncuya en fazla %${havuz} verebilirsin (havuz payın).`);

  // SAYI SINIRI YOK (2026-07-26 kullanıcı kararı): baş komisyoncu istediği kadar
  // komisyoncu açabilir. Kötüye kullanım freni yerine izlenebilirlik: her hesap
  // admin ekranında baş komisyoncusuyla birlikte görünür.
  const varOlan = await prisma.user.findFirst({
    where: { OR: [{ username }, { phone }] },
    select: { username: true },
  });
  if (varOlan)
    hata(
      varOlan.username === username
        ? "Bu kullanıcı adı zaten kullanımda."
        : "Bu telefon zaten kayıtlı.",
    );

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: "AGENT",
          name,
          phone,
          username,
          password: await hashPassword(password),
        },
      });
      await tx.agent.create({
        data: {
          userId: user.id,
          percent: Math.round(percent * 100) / 100,
          parentId: head.id,
          isHead: false, // 3. kademe YOK
          canDiscount: altIndirim,
        },
      });
    });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      hata("Telefon/kullanıcı adı az önce alındı — tekrar deneyin.");
    }
    throw e;
  }
  revalidatePath("/komisyoncu");
  redirect("/komisyoncu?yeniKomisyoncu=" + encodeURIComponent(username));
}

/** Kendi alt komisyoncusunu pasife al / aktive et (yalnız kendi ağacı). */
export async function toggleSubAgentActive(formData: FormData) {
  const head = await requireHeadAgent();
  const id = String(formData.get("id") || "");
  const alt = await prisma.agent.findFirst({
    where: { id, parentId: head.id }, // SAHİPLİK: başkasının komisyoncusuna dokunamaz
    select: { id: true, active: true, suspendedByAdmin: true },
  });
  if (!alt) {
    revalidatePath("/komisyoncu");
    return;
  }
  // ADMIN DONDURMASI (inceleme bulgusu): admin bir komisyoncuyu kestiyse baş
  // komisyoncu bunu kendi panelinden geri AÇAMAZ — aksi halde yönetici kararı
  // sessizce iptal edilirdi.
  if (alt.suspendedByAdmin) {
    redirect(
      "/komisyoncu?hata=" +
        encodeURIComponent(
          "Bu komisyoncu yönetim tarafından donduruldu — yalnız yönetici açabilir.",
        ),
    );
  }
  await prisma.agent.updateMany({
    where: { id: alt.id, active: alt.active }, // koşullu yaz (TOCTOU)
    data: { active: !alt.active },
  });
  revalidatePath("/komisyoncu");
}

// ---- ÖDEME (ÇEKİM) TALEBİ — 2026-07-26 ----
// Komisyoncu birikmiş bakiyesi için talep oluşturur; havaleyi admin elle yapar.
// İstersen her ayın belirli günü otomatik talep düşer (lib/payout.ts).

/** IBAN + aylık otomatik talep gününü kaydet (komisyoncunun kendi bilgisi). */
export async function savePayoutInfo(formData: FormData) {
  const u = await getSessionUser();
  if (!u || u.role !== "AGENT") redirect("/giris");
  const agent = await prisma.agent.findUnique({
    where: { userId: u!.id },
    select: { id: true },
  });
  if (!agent) redirect("/giris");

  const hata = (m: string) => {
    redirect("/komisyoncu?hata=" + encodeURIComponent(m));
  };
  // IBAN: boşluklar atılır, TR + 24 hane beklenir (boş = kaldır).
  const ibanRaw = String(formData.get("iban") || "").replace(/\s+/g, "").toUpperCase();
  if (ibanRaw && !/^TR\d{24}$/.test(ibanRaw))
    hata("IBAN 'TR' ile başlayıp 26 karakter olmalı (TR + 24 hane).");
  const gunRaw = String(formData.get("payoutDay") || "").trim();
  let payoutDay: number | null = null;
  if (gunRaw) {
    const g = Number(gunRaw);
    if (!Number.isInteger(g) || g < 1 || g > 28)
      hata("Ödeme günü 1 ile 28 arasında olmalı (ay sonu kaymalarını önlemek için).");
    payoutDay = g;
  }
  await prisma.agent.update({
    where: { id: agent!.id },
    data: { iban: ibanRaw || null, payoutDay },
  });
  revalidatePath("/komisyoncu");
  redirect("/komisyoncu?odemeBilgisi=1");
}

/** Bakiyesi için çekim talebi oluştur (aynı anda tek bekleyen talep). */
export async function requestPayout() {
  const u = await getSessionUser();
  if (!u || u.role !== "AGENT") redirect("/giris");
  const agent = await prisma.agent.findUnique({
    where: { userId: u!.id },
    select: { id: true, active: true, iban: true },
  });
  if (!agent) redirect("/giris");

  const hata = (m: string) => {
    redirect("/komisyoncu?hata=" + encodeURIComponent(m));
  };
  if (!agent.active) hata("Hesabın pasif — ödeme talebi oluşturamazsın.");
  if (!agent.iban)
    hata("Önce IBAN'ını kaydet — havale oraya yapılacak.");

  const bekleyen = await prisma.payoutRequest.count({
    where: { agentId: agent!.id, status: "PENDING" },
  });
  if (bekleyen > 0)
    hata("Zaten bekleyen bir ödeme talebin var — o sonuçlanınca yenisini oluşturabilirsin.");

  const { agentBalance } = await import("@/lib/payout");
  const bakiye = await agentBalance(agent!.id);
  if (bakiye.toplam <= 0)
    hata("Ödenecek bakiyen yok — tahakkuk oluştukça burada görünür.");

  await prisma.payoutRequest.create({
    data: {
      agentId: agent!.id,
      amount: bakiye.toplam,
      iban: agent!.iban,
    },
  });
  // Yöneticiye zil: talep beklemede kalmasın.
  const { notifyAdmins } = await import("@/lib/notify");
  await notifyAdmins({
    type: "genel",
    title: "Komisyon ödeme talebi",
    body: `${u!.name} ${bakiye.toplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL çekim talebi oluşturdu.`,
    href: "/admin/komisyoncular",
  }).catch(() => {});
  revalidatePath("/komisyoncu");
  redirect("/komisyoncu?talep=1");
}

/** Kendi komisyoncusunun İNDİRİM yetkisini aç/kapat (yalnız kendi ekibi ve
 *  yalnız baş komisyoncunun kendi yetkisi varsa). Kapatmak geçmiş kodlardaki
 *  indirimleri ve işletmelere işlenmiş indirimleri DURDURMAZ (verilmiş söz
 *  tutulur) — yalnız yeni indirimli kod üretemez. */
export async function toggleSubAgentDiscount(formData: FormData) {
  const head = await requireHeadAgent();
  if (!head.canDiscount) {
    redirect(
      "/komisyoncu?hata=" +
        encodeURIComponent("İndirim yetkin yok — komisyoncuna da veremezsin."),
    );
  }
  const id = String(formData.get("id") || "");
  const alt = await prisma.agent.findFirst({
    where: { id, parentId: head.id }, // SAHİPLİK: yalnız kendi ekibi
    select: { id: true, canDiscount: true },
  });
  if (alt) {
    await prisma.agent.updateMany({
      where: { id: alt.id, canDiscount: alt.canDiscount }, // koşullu yaz (TOCTOU)
      data: { canDiscount: !alt.canDiscount },
    });
  }
  revalidatePath("/komisyoncu");
}
