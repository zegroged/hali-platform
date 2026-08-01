"use server";

import { revalidatePath } from "next/cache";
import { bolgeOku } from "@/lib/territory";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isValidTaxOrTckn, taxIdError } from "@/lib/taxId";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { uretKodMetni } from "@/lib/referralCode";
import { normalizePhone, isTrPhone } from "@/lib/phone";
import { normalizeUsername, validateUsername } from "@/lib/username";
import { MAX_SUB_DISCOUNT, MAX_SUB_DISCOUNT_MONTHS } from "@/lib/discount";

// Komisyoncunun TEK yetkili aksiyonu: kendi adına tek kullanımlık kod üretmek.
// Her müşteri için ayrı kod üretilir; kod bir işletmeye bağlanınca yanar.
// PREMIUM (canDiscount) komisyoncu koda indirim gömebilir: yüzde + kaç ay.
export async function generateReferralCode(formData: FormData) {
  const u = await getSessionUser();
  if (!u || u.role !== "AGENT") redirect("/giris");

  const agent = await prisma.agent.findUnique({
    where: { userId: u.id },
    select: {
      id: true,
      active: true,
      canDiscount: true,
      maxDiscountPercent: true,
      maxDiscountMonths: true,
    },
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
    // 🔴 MUTLAK PLATFORM TAVANI (2026-08-02, kullanıcı kararı — 4.21'deki
    // "admin'in premium yaptığı sınırsız olsun" tasarımı GERİ ALINDI):
    // HİÇBİR komisyoncu %20'den fazla ya da 12 aydan uzun indirim basamaz.
    // Kişiye özel tavan (maxDiscountPercent/Months) yalnız DAHA SIKI olabilir.
    const tavan = Math.min(
      Number(agent.maxDiscountPercent ?? MAX_SUB_DISCOUNT),
      MAX_SUB_DISCOUNT,
    );
    const ayTavan = Math.min(
      agent.maxDiscountMonths ?? MAX_SUB_DISCOUNT_MONTHS,
      MAX_SUB_DISCOUNT_MONTHS,
    );
    if (!Number.isFinite(pct) || pct <= 0)
      hataDon("İndirim yüzdesi 1 ile " + tavan + " arasında olmalı.");
    if (pct > tavan)
      hataDon(`En fazla %${tavan} indirim tanımlayabilirsin (platform tavanı).`);
    if (ay > ayTavan)
      hataDon(`İndirim süresi en fazla ${ayTavan} ay olabilir (platform tavanı).`);
    if (!Number.isInteger(ay) || ay < 1)
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
  // BÖLGE (2026-07-28): baş komisyoncu açtığı kişiye il+ilçe atar. Çakışma
  // engellenmez, form dolu ilçeleri uyarıyla gösterir (lib/territory.ts).
  const bolge = bolgeOku(
    String(formData.get("territoryCity") || ""),
    formData.getAll("territoryDistrict").map((d) => String(d)),
  );
  // İl seçilip ilçe seçilmediyse sessizce geçme (denetim bulgusu).
  if (!bolge.ok) hata(bolge.hata);
  const password = String(formData.get("password") || "");
  const percentRaw = String(formData.get("percent") || "").replace(",", ".").trim();
  const havuz = Number(head.poolPercent ?? 0);
  // İNDİRİM YETKİSİ DEVRİ (2026-07-26 kullanıcı kararı): baş komisyoncu, açtığı
  // komisyoncuya indirim yetkisi verebilir — AMA yalnız KENDİSİNDE varsa.
  // Sahip olmadığı yetkiyi dağıtamaz (yetki yükseltme deliği olmasın).
  const altIndirim = formData.get("canDiscount") === "on" && head.canDiscount;
  // TAVAN: baş komisyoncu seçer, platform sınırı %20 (MAX_SUB_DISCOUNT).
  const tavanRaw = String(formData.get("maxDiscount") || "").replace(",", ".").trim();
  const ayTavanRaw = String(formData.get("maxDiscountMonths") || "").trim();

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

  let altTavan: number | null = null;
  let altAyTavan: number | null = null;
  if (altIndirim) {
    const t = Number(tavanRaw);
    if (!Number.isFinite(t) || t <= 0 || t > MAX_SUB_DISCOUNT)
      hata(`İndirim tavanı 1 ile ${MAX_SUB_DISCOUNT} arasında olmalı.`);
    altTavan = Math.round(t * 100) / 100;
    const a = Number(ayTavanRaw);
    if (!Number.isInteger(a) || a <= 0 || a > MAX_SUB_DISCOUNT_MONTHS)
      hata(`İndirim süresi tavanı 1 ile ${MAX_SUB_DISCOUNT_MONTHS} ay arasında olmalı.`);
    altAyTavan = a;
  }

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
      const yeni = await tx.agent.create({
        data: {
          userId: user.id,
          percent: Math.round(percent * 100) / 100,
          parentId: head.id,
          isHead: false, // 3. kademe YOK
          canDiscount: altIndirim,
          maxDiscountPercent: altTavan,
          maxDiscountMonths: altAyTavan,
        },
      });
      if (bolge.ok && bolge.city) {
        await tx.agentTerritory.createMany({
          data: bolge.districts.map((d: string) => ({
            agentId: yeni.id,
            city: bolge.city as string,
            district: d,
          })),
          skipDuplicates: true,
        });
      }
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
  // AD SOYAD (2026-07-31, kullanıcı isteği): IBAN kaydediliyorsa hesap sahibinin
  // adı ZORUNLU — bankalar isim uyuşmazlığında havaleyi geri çeviriyor; admin de
  // havaleyi isimsiz yapamıyordu.
  const ibanName = String(formData.get("ibanName") || "").trim();
  if (ibanRaw && ibanName.length < 5)
    hata("IBAN ile birlikte hesap sahibinin adı soyadı zorunlu (banka kaydındaki haliyle).");
  // TCKN/VKN (opsiyonel): stopajlı ödemede gider pusulasına yazılır. Girildiyse
  // resmî algoritmayla doğrulanır (uydurma numara belgeye girmesin).
  const taxIdRaw = String(formData.get("taxId") || "").replace(/\D/g, "");
  if (taxIdRaw && !isValidTaxOrTckn(taxIdRaw))
    hata(taxIdError(taxIdRaw) ?? "Vergi/T.C. kimlik numarası doğrulanamadı.");
  // ADRES (2026-08-01, VUK 234 araştırması): gider pusulasının zorunlu şekil
  // şartı — işi yapanın adresi. IBAN kaydıyla birlikte istenir.
  const address = String(formData.get("address") || "").trim();
  if (ibanRaw && address.length < 10)
    hata("Adres zorunlu (gider pusulası/vergi belgesi için) — mahalle, ilçe ve il ile yaz.");
  // payoutDay KALDIRILDI (2026-07-31): ödemeler herkese ayın son günü.
  await prisma.agent.update({
    where: { id: agent!.id },
    data: {
      iban: ibanRaw || null,
      ibanName: ibanRaw ? ibanName : null,
      taxId: taxIdRaw || null,
      address: address || null,
    },
  });
  revalidatePath("/komisyoncu");
  redirect("/komisyoncu?odemeBilgisi=1");
}

// requestPayout KALDIRILDI (2026-07-31): elle talep yok — ay sonu otomatik
// toplu ödeme (lib/payout.ts createScheduledPayoutRequests).

/** Kendi komisyoncusunun İNDİRİM yetkisini ve TAVANINI belirle (yalnız kendi
 *  ekibi, yalnız kendi yetkisi varsa). Tavan boş/0 → yetki kapatılır. Kapatmak
 *  daha önce verilmiş indirimleri DURDURMAZ (verilmiş söz tutulur). */
export async function setSubAgentDiscount(formData: FormData) {
  const head = await requireHeadAgent();
  if (!head.canDiscount) {
    redirect(
      "/komisyoncu?hata=" +
        encodeURIComponent("İndirim yetkin yok — komisyoncuna da veremezsin."),
    );
  }
  const id = String(formData.get("id") || "");
  const raw = String(formData.get("maxDiscount") || "").replace(",", ".").trim();
  const ayRaw = String(formData.get("maxDiscountMonths") || "").trim();
  const alt = await prisma.agent.findFirst({
    where: { id, parentId: head.id }, // SAHİPLİK: yalnız kendi ekibi
    select: { id: true },
  });
  if (!alt) {
    revalidatePath("/komisyoncu");
    return;
  }
  if (!raw || Number(raw) === 0) {
    await prisma.agent.update({
      where: { id: alt.id },
      data: { canDiscount: false, maxDiscountPercent: null, maxDiscountMonths: null },
    });
    revalidatePath("/komisyoncu");
    return;
  }
  const t = Number(raw);
  if (!Number.isFinite(t) || t <= 0 || t > MAX_SUB_DISCOUNT) {
    redirect(
      "/komisyoncu?hata=" +
        encodeURIComponent(`İndirim tavanı 1 ile ${MAX_SUB_DISCOUNT} arasında olmalı.`),
    );
  }
  const a = ayRaw ? Number(ayRaw) : MAX_SUB_DISCOUNT_MONTHS;
  if (!Number.isInteger(a) || a <= 0 || a > MAX_SUB_DISCOUNT_MONTHS) {
    redirect(
      "/komisyoncu?hata=" +
        encodeURIComponent(`Süre tavanı 1 ile ${MAX_SUB_DISCOUNT_MONTHS} ay arasında olmalı.`),
    );
  }
  await prisma.agent.update({
    where: { id: alt.id },
    data: {
      canDiscount: true,
      maxDiscountPercent: Math.round(t * 100) / 100,
      maxDiscountMonths: a,
    },
  });
  revalidatePath("/komisyoncu");
}


/** Baş komisyoncu KENDİ ekibindeki bir komisyoncunun bölgesini günceller.
 *  Yalnız kendi altındakine dokunabilir (parentId kontrolü) — 2026-07-28. */
export async function setSubAgentTerritory(formData: FormData) {
  const head = await requireHeadAgent();
  const agentId = String(formData.get("agentId") || "");
  const hata2 = (m: string) =>
    redirect("/komisyoncu?hata=" + encodeURIComponent(m));
  if (!agentId) hata2("Komisyoncu bulunamadı.");

  const bolge = bolgeOku(
    String(formData.get("territoryCity") || ""),
    formData.getAll("territoryDistrict").map((d) => String(d)),
  );
  if (!bolge.ok) hata2(bolge.hata);

  // YETKİ: yalnız kendi altındaki hesap. Başkasının ekibine dokunamaz.
  const alt = await prisma.agent.findFirst({
    where: { id: agentId, parentId: head.id },
    select: { id: true },
  });
  if (!alt) hata2("Bu komisyoncu senin ekibinde değil.");

  await prisma.$transaction(async (tx) => {
    await tx.agentTerritory.deleteMany({ where: { agentId } });
    if (bolge.ok && bolge.city && bolge.districts.length > 0) {
      await tx.agentTerritory.createMany({
        data: bolge.districts.map((d: string) => ({
          agentId,
          city: bolge.city as string,
          district: d,
        })),
        skipDuplicates: true,
      });
    }
  });
  revalidatePath("/komisyoncu");
  revalidatePath("/komisyoncu/bolgeler");
  redirect("/komisyoncu?ok=" + encodeURIComponent("Bölge güncellendi"));
}
