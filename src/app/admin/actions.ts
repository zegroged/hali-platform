"use server";

import { revalidatePath } from "next/cache";
import { bolgeOku } from "@/lib/territory";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { profileComplete, syncVisibility } from "@/lib/panel";
import { extendSubscription } from "@/lib/subscription";
import { taxIdError } from "@/lib/taxId";
import { isTrPhone, normalizePhone } from "@/lib/phone";
import { normalizeCityName, normalizeDistrictName } from "@/lib/cities";
import { normalizeUsername, validateUsername } from "@/lib/username";
import { saveObject } from "@/lib/storage";
import { CONTRACT_VERSION } from "@/lib/legal";
import { normalizeBusinessName } from "@/lib/text";
import { ensureBillingCode } from "@/lib/billing";
import { findUsableCode, claimCode, attachCodeToBusiness } from "@/lib/referralCode";
import { discountUntilFromMonths, activeDiscountPercent } from "@/lib/discount";

async function requireAdmin() {
  const u = await getSessionUser();
  if (!u || u.role !== "ADMIN") redirect("/giris");
}

/**
 * Mali müşavir (ACCOUNTANT) hesabı oluştur. YALNIZ admin. Bu hesap admin paneline
 * giremez; yalnız /muhasebe'de fatura bilgileri + ödemeleri görür (salt-okunur).
 * Admin kullanıcı adı + şifre belirler, mali müşavire verir.
 */
export async function createAccountant(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const usernameRaw = String(formData.get("username") || "").trim();
  const phone = normalizePhone(String(formData.get("phone") || ""));
  const password = String(formData.get("password") || "");
  const err = (m: string) =>
    redirect("/admin/mali-musavir?hata=" + encodeURIComponent(m));

  if (name.length < 2) err("Ad girin.");
  if (phone.length < 10) err("Geçerli bir telefon girin.");
  const username = normalizeUsername(usernameRaw);
  const uErr = validateUsername(username);
  if (uErr) err(uErr);
  if (password.length < 8) err("Şifre en az 8 karakter olmalı.");

  // Telefon ve kullanıcı adı benzersiz olmalı (User @unique).
  const exists = await prisma.user.findFirst({
    where: { OR: [{ username }, { phone }] },
  });
  if (exists) {
    err(
      exists.username === username
        ? "Bu kullanıcı adı zaten kullanımda."
        : "Bu telefon zaten kayıtlı.",
    );
  }
  await prisma.user.create({
    data: {
      role: "ACCOUNTANT",
      name,
      phone,
      username,
      password: await hashPassword(password),
    },
  });
  revalidatePath("/admin/mali-musavir");
  redirect("/admin/mali-musavir?ok=" + encodeURIComponent(username));
}

// Admin'in ilçe koordinatı çözmesi (kayıt route'uyla aynı; erişilemezse İstanbul).
async function geocodeDistrict(district: string, city: string) {
  try {
    const res = await fetch(
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=" +
        encodeURIComponent(`${district}, ${city}`),
      {
        headers: { "User-Agent": "EnYakinHaliYikama/1.0 (+https://enyakinhaliyikamaservisi.com; destek@enyakinhaliyikamaservisim.com)", "Accept-Language": "tr" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (res.ok) {
      const d = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (d.length) return { lat: Number(d[0].lat), lng: Number(d[0].lon) };
    }
  } catch {
    /* varsayılan */
  }
  return { lat: 41.0082, lng: 28.9784 };
}

/**
 * Admin tarafından işletme oluştur: doğrulama/ödeme kapıları YOK. Hesap
 * VERIFIED + sözleşme onaylı + e-posta doğrulanmış + SÜRESİZ ÜCRETSİZ abonelik
 * (dönem 2099) ile açılır. Fotoğraf ve şoför fiziki gerçeklik olduğundan
 * eklenince otomatik yayına girer (syncVisibility). Geçici şifre admin'e gösterilir.
 */
export async function createBusinessByAdmin(formData: FormData) {
  // ADMIN veya SUPPORT (müşteri hizmetleri — tek yetkisi bu aksiyon).
  const admin = await getSessionUser();
  if (!admin || (admin.role !== "ADMIN" && admin.role !== "SUPPORT"))
    redirect("/giris");
  const isSupport = admin.role === "SUPPORT";
  const formPath = isSupport ? "/destek" : "/admin/yeni";

  const businessName = String(formData.get("businessName") || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim();
  const phone = normalizePhone(String(formData.get("phone") || ""));
  const email = String(formData.get("email") || "").trim().toLowerCase();
  // Giriş bilgileri oluşturan kişi tarafından belirlenir (sahibine iletir).
  const password = String(formData.get("password") || "");
  const usernameRaw = String(formData.get("username") || "").trim();
  // İl/ilçe yalnız resmî listeden: kanonik ada normalize edilir (form zaten
  // seçtiriyor; elle gönderilen listede-olmayan değer aşağıda reddedilir).
  const city =
    normalizeCityName(String(formData.get("city") || "")) ?? "";
  const district = city
    ? (normalizeDistrictName(city, String(formData.get("district") || "")) ?? "")
    : "";
  const taxNumber = String(formData.get("taxNumber") || "").replace(/\D/g, "");
  // Komisyoncu kodu (opsiyonel): doluysa geçerli olmalı — işletme bu
  // komisyoncuya bağlanır, her abonelik ödemesinde komisyon işler.
  const agentCode = String(formData.get("agentCode") || "").trim().toUpperCase();
  const pricePerM2 = Number(formData.get("pricePerM2")) || null;
  const minDays = Number(formData.get("minDays")) || null;
  const maxDays = Number(formData.get("maxDays")) || null;
  // Opsiyonel ilk şoför — yayın şartı (foto + ≥1 şoför) tek ekranda tamamlansın.
  const dName = String(formData.get("driverName") || "").trim();
  const dPhone = normalizePhone(String(formData.get("driverPhone") || ""));
  const dUsername = normalizeUsername(String(formData.get("driverUsername") || ""));
  const dPassword = String(formData.get("driverPassword") || "");
  const wantsDriver = Boolean(dName || dPhone || dUsername || dPassword);
  // Fotoğraflar (jpg/png/webp, ≤5MB/adet; action gövdesi toplam 8MB):
  // photos = genel işletme fotoğrafları (ZORUNLU ≥1), logo tek dosya (ops.),
  // photosBefore/photosAfter = öncesi/sonrası galerisi (ops.).
  const pickFiles = (name: string, max: number) =>
    formData
      .getAll(name)
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, max);
  const photos = pickFiles("photos", 20);
  const logoFile = pickFiles("logo", 1)[0] ?? null;
  const photosBefore = pickFiles("photosBefore", 20);
  const photosAfter = pickFiles("photosAfter", 20);

  const err = (msg: string) =>
    redirect(formPath + "?hata=" + encodeURIComponent(msg));

  // TAM YETKİ (2026-07-13, kullanıcı kararı): admin/destek işletme açarken
  // HİÇBİR ALAN ZORUNLU DEĞİL — girilenlerin yalnız biçimi doğrulanır, boş
  // kalan her şey otomatik üretilir (ad, telefon, kullanıcı adı, şifre).
  // Yayın için tek şart FOTOĞRAF (hesap fotoğrafsız da açılır, foto gelince
  // otomatik yayınlanır); sipariş için şoför şartı API katmanında sürer.
  if (phone && !isTrPhone(phone))
    err(
      "Telefon 11 hane olmalı — 05xx cep ya da 0xxx sabit hat (0212, 0342…). Boş da bırakabilirsin.",
    );
  if (email && !/^\S+@\S+\.\S+$/.test(email))
    err("E-posta girildiyse geçerli olmalı (ya da boş bırak).");
  if (password && password.length < 8)
    err("Şifre girildiyse en az 8 karakter olmalı (boşsa geçici şifre üretilir).");
  const username = usernameRaw ? normalizeUsername(usernameRaw) : null;
  if (username) {
    const uErr = validateUsername(username);
    if (uErr) err(uErr);
  }
  // TEK KULLANIMLIK komisyoncu kodu: işletme OLUŞMADAN önce atomik tüketilir
  // (yarışı kaybeden kayıt anlaşılır hatayla durur; yanan kod geri gelmez).
  let agentId: string | null = null;
  let claimedCodeId: string | null = null;
  let kodIndirim: { percent: number; months: number } | null = null;
  if (agentCode) {
    const bulunan = await findUsableCode(agentCode);
    if (!bulunan)
      err("Komisyoncu kodu geçersiz, kullanılmış ya da komisyoncu pasif: " + agentCode);
    if (!(await claimCode(bulunan!.codeId)))
      err("Komisyoncu kodu az önce kullanıldı — komisyoncudan yeni kod isteyin.");
    agentId = bulunan!.agentId;
    claimedCodeId = bulunan!.codeId;
    if (bulunan!.discountPercent && bulunan!.discountMonths)
      kodIndirim = { percent: bulunan!.discountPercent, months: bulunan!.discountMonths };
  }
  // İl/ilçe de boş kalabilir — sahibi sonradan panelden listeden seçer.
  // AYRICALIK (2026-07-13, kullanıcı kararı): ADMIN/SUPPORT işletme açarken
  // vergi/TC checksum'ı ARANMAZ — sahadan hızlı kayıt için; numara boş ya da
  // doğrulanmamış girilebilir, sahibi sonradan panelden düzeltir. Kamuya yalnız
  // 10 haneli değer gösterildiğinden (publicTaxNumber) TC sızmaz; uydurma VKN
  // görünme riski bilinçli kabul edildi. Öz-servis kayıt + panel profili
  // checksum'lı kalır (taxIdError orada aranmaya devam eder).
  if (wantsDriver) {
    // Şoför alanlarından biri doldurulduysa hepsi gerekli (yarım hesap olmasın).
    if (dName.length < 2) err("Şoför adı gerekli.");
    if (!isTrPhone(dPhone))
      err("Şoför telefonu 11 hane olmalı (05xx cep ya da 0xxx sabit hat).");
    const dErr = validateUsername(dUsername);
    if (dErr) err("Şoför kullanıcı adı: " + dErr);
    if (dPassword.length < 8) err("Şoför şifresi en az 8 karakter olmalı.");
    if (dUsername === username)
      err("Şoförün kullanıcı adı işletme sahibininkiyle aynı olamaz.");
    if (dPhone === phone) err("Şoför telefonu işletme telefonuyla aynı olamaz.");
  }

  const exists = await prisma.user.findFirst({
    where: {
      OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
    },
    select: { id: true },
  });
  if (exists) err("Bu telefon veya e-posta ile zaten bir hesap var.");

  // İşletme adı boşsa üret ("Yeni İşletme 123") — panelden düzeltilir.
  // Doluysa BÜYÜK HARF normalize (destek sahadan çoğunlukla bağıran ad girer).
  const finalBusinessName = businessName
    ? normalizeBusinessName(businessName)
    : `Yeni İşletme ${crypto.randomInt(100, 1000)}`;
  // Telefon boşsa benzersiz GEÇİCİ numara üret (User.phone unique — boş
  // bırakılamaz); mesajda gösterilir, sahibi panelden gerçeğini yazar.
  let finalPhone = phone;
  let generatedPhone = false;
  while (!finalPhone) {
    const aday = `05${crypto.randomInt(100000000, 1000000000)}`;
    const taken = await prisma.user.findFirst({
      where: { phone: aday },
      select: { id: true },
    });
    if (!taken) {
      finalPhone = aday;
      generatedPhone = true;
    }
  }

  // Giriş kimliği garantisi: e-posta VE kullanıcı adı boşsa işletme adından
  // benzersiz kullanıcı adı, şifre boşsa geçici şifre üret (mesajda gösterilir).
  let finalUsername = username;
  if (!email && !finalUsername) {
    const base =
      normalizeUsername(finalBusinessName)
        .replace(/[^a-z0-9._-]/g, "")
        .slice(0, 20) || "isletme";
    for (let i = 0; i < 5 && !finalUsername; i++) {
      const aday = `${base}${crypto.randomInt(10, 100)}`;
      if (validateUsername(aday)) continue;
      const taken = await prisma.user.findUnique({
        where: { username: aday },
        select: { id: true },
      });
      if (!taken) finalUsername = aday;
    }
    if (!finalUsername) finalUsername = `isletme.${crypto.randomInt(100000, 1000000)}`;
  }
  const generatedPassword = !password;
  const finalPassword = password || `Gecici-${crypto.randomInt(100000, 1000000)}`;
  if (username) {
    const taken = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (taken) err("Bu kullanıcı adı alınmış. Başka bir tane seçin.");
  }
  if (wantsDriver) {
    const dTaken = await prisma.user.findFirst({
      where: { OR: [{ phone: dPhone }, { username: dUsername }] },
      select: { phone: true },
    });
    if (dTaken)
      err(
        dTaken.phone === dPhone
          ? "Şoför telefonu başka bir hesapta kayıtlı."
          : "Şoför kullanıcı adı alınmış. Başka bir tane seçin.",
      );
  }

  // Konum: il/ilçe girildiyse geocode; boşsa İstanbul merkezi ile açılır
  // (sahibi panelden ilini seçince keşif "mesafe" sıralaması ona göre düzelmez —
  // bilinen sınır; kritik değil çünkü şehir eşleşmesi metin bazlı).
  const { lat, lng } =
    city && district
      ? await geocodeDistrict(district, city)
      : { lat: 41.0082, lng: 28.9784 };
  const farFuture = new Date("2099-12-31T00:00:00.000Z"); // süresiz ücretsiz

  const owner = await prisma.user.create({
    data: {
      role: "CLEANER",
      name: ownerName || finalBusinessName, // yetkili adı boşsa işletme adı
      phone: finalPhone,
      username: finalUsername, // boşsa yukarıda üretildi (e-posta varsa null olabilir)
      email: email || null,
      emailVerified: Boolean(email), // e-posta yoksa doğrulanacak şey de yok
      password: await hashPassword(finalPassword),
      ownedBusiness: {
        create: {
          name: finalBusinessName,
          ...(agentId ? { referredByAgent: { connect: { id: agentId } } } : {}),
          // Koda gömülü abonelik indirimi create İÇİNDE (inceleme bulgusu:
          // sonradan ayrı update + sessiz catch, indirimi kaybedebiliyordu).
          ...(kodIndirim
            ? {
                discountPercent: kodIndirim.percent,
                discountUntil: discountUntilFromMonths(kodIndirim.months),
                discountGrantedByAgentId: agentId, // yarısı ondan düşer
              }
            : {}),
          address: city && district ? `${district}, ${city}` : "",
          city,
          district,
          lat,
          lng,
          phone: finalPhone,
          taxNumber: taxNumber || null,
          deliveryEstimateMinDays: minDays,
          deliveryEstimateMaxDays: maxDays,
          workingHours: {
            mon: { open: "09:00", close: "19:00" },
            tue: { open: "09:00", close: "19:00" },
            wed: { open: "09:00", close: "19:00" },
            thu: { open: "09:00", close: "19:00" },
            fri: { open: "09:00", close: "19:00" },
            sat: { open: "10:00", close: "17:00" },
            sun: null,
          },
          // ⚠️ ROZET OTOMATİK VERİLMEZ (2026-07-28 denetim — YÜKSEK).
          // Eskiden burası "VERIFIED" idi ("doğrulama kapısı yok" gerekçesiyle).
          // Ama VERIFIED yayına girme kapısı DEĞİL — müşteriye gösterilen
          // "Doğrulanmış İşletme" ROZETİNİ sürüyor. Yani destek panelinden
          // telefonla açılan, hiçbir belgesi görülmemiş her işletme müşteriye
          // "doğrulanmış" diye sunuluyordu; rozet güven işareti olmaktan çıkıp
          // yanıltıcı hale geliyordu. PENDING = yayına girer ama rozeti yoktur;
          // admin belgeyi görünce /admin/isletme/[id]'den verir.
          verification: "PENDING",
          isVisible: false, // syncVisibility hesaplar (profil tamamlanınca açılır)
          createdByAdmin: true, // şoför YAYIN şartından muaf (sipariş için yine gerekir)
          contractAcceptedAt: new Date(),
          contractVersion: CONTRACT_VERSION,
          adminNote: `${isSupport ? "Müşteri Hizmetleri" : "Admin"} (${admin.name}) tarafından açıldı — süresiz ücretsiz abonelik.`,
          // Hizmet bölgesi yalnız il+ilçe girildiyse (boş bölge kaydı olmasın)
          ...(city && district
            ? { serviceAreas: { create: [{ city, district }] } }
            : {}),
          ...(pricePerM2
            ? { pricing: { create: [{ label: "Makine Halısı", unit: "PER_M2", price: pricePerM2 }] } }
            : {}),
          badges: { create: [{ type: "VERIFIED" }] },
          subscription: {
            create: {
              status: "ACTIVE",
              currentPeriodStart: new Date(),
              currentPeriodEnd: farFuture,
            },
          },
        },
      },
    },
    include: { ownedBusiness: { select: { id: true } } },
  });

  const businessId = owner.ownedBusiness!.id;

  // Cari/abone kodu (muhasebe eşleştirmesi) — hata hesabı engellemesin.
  await ensureBillingCode(businessId).catch(() => {});
  if (claimedCodeId) await attachCodeToBusiness(claimedCodeId, businessId);

  // Opsiyonel ilk şoför (yayın şartı) — panel addDriver ile aynı mantık.
  if (wantsDriver) {
    const driverUser = await prisma.user.create({
      data: {
        role: "DRIVER",
        name: dName,
        phone: dPhone,
        username: dUsername,
        password: await hashPassword(dPassword),
      },
    });
    await prisma.driver.create({
      data: { userId: driverUser.id, businessId },
    });
  }

  // Fotoğraflar — /api/panel/upload ile aynı işlem (küçült + WebP; hata → orijinal).
  const PHOTO_TYPES: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const saveImage = async (
    file: File,
    edge: number,
  ): Promise<string | null> => {
    const rawExt = PHOTO_TYPES[file.type];
    if (!rawExt || file.size > 5 * 1024 * 1024) return null;
    const original = Buffer.from(await file.arrayBuffer());
    let buf = original;
    let contentType = file.type;
    try {
      buf = await sharp(original, { limitInputPixels: 50_000_000 })
        .rotate()
        .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer();
      contentType = "image/webp";
    } catch {
      // sharp hata verirse orijinal dosyaya düş
    }
    const ext = contentType === "image/webp" ? "webp" : rawExt;
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    return saveObject(`uploads/${businessId}/${name}`, buf, contentType);
  };
  // Genel + öncesi + sonrası galeriye; logo işletme kaydına.
  const batches: [File[], boolean, boolean][] = [
    [photos, false, false], // genel
    [photosBefore, true, false],
    [photosAfter, false, true],
  ];
  for (const [list, isBefore, isAfter] of batches) {
    for (const file of list) {
      const url = await saveImage(file, 2560);
      if (!url) continue;
      await prisma.businessPhoto.create({
        data: { businessId, url, isBefore, isAfter },
      });
    }
  }
  if (logoFile) {
    const url = await saveImage(logoFile, 512);
    if (url) {
      await prisma.cleanerBusiness.update({
        where: { id: businessId },
        data: { logoUrl: url },
      });
    }
  }

  await syncVisibility(businessId); // foto+şoför varsa hemen yayına al
  revalidatePath("/admin");
  // Giriş kimliği: e-posta/kullanıcı adı (boşsa üretilen) + şifre (boşsa geçici).
  const girisKimlik = email
    ? `${email}${finalUsername ? ` veya kullanıcı adı "${finalUsername}"` : ""}`
    : `kullanıcı adı "${finalUsername}"`;
  const mesaj = encodeURIComponent(
    `İşletme oluşturuldu: ${finalBusinessName}. Giriş: ${girisKimlik}` +
      (generatedPassword
        ? ` · geçici şifre: ${finalPassword}`
        : " · belirlediğin şifre") +
      " (sahibine ilet)." +
      (generatedPhone
        ? ` Geçici telefon üretildi: ${finalPhone} — panelden gerçeğiyle değiştirin.`
        : "") +
      (email && !finalUsername ? " İlk girişte kullanıcı adı belirleyecek." : "") +
      (photos.length === 0 ? " Fotoğraf eklenince yayına girer." : "") +
      (wantsDriver
        ? ` Şoför girişi: kullanıcı adı "${dUsername}" · belirlediğin şoför şifresi.`
        : " Not: şoför eklenmeden sipariş alınamaz."),
  );
  // SUPPORT admin detay sayfasını göremez — kendi sayfasına döner (şifre mesajda).
  redirect(
    isSupport
      ? `/destek?mesaj=${mesaj}`
      : `/admin/isletme/${businessId}?mesaj=${mesaj}`,
  );
}

export async function approveBusiness(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));

  // Eksik profilli işletme onaylanamaz (müşteriye yarım profil çıkmasın).
  const business = await prisma.cleanerBusiness.findUnique({
    where: { id },
    include: { pricing: true, serviceAreas: true, photos: true },
  });
  if (!business) return;
  if (!profileComplete(business)) {
    // Çıplak throw hata sayfasına düşürüyordu ("Bir şeyler ters gitti") —
    // bunun yerine panele dostane mesajla dön; eksikler detay sayfasında.
    redirect(
      "/admin?hata=" +
        encodeURIComponent(
          `"${business.name}" onaylanamadı: profili eksik (detay sayfasındaki eksik listesine bak).`,
        ),
    );
  }

  // Onay = yalnız "Doğrulanmış" ROZETİ (2026-07-08): yayına çıkma artık
  // otomatiktir (profil tam + ödeme — bkz syncVisibility). REJECTED'dan
  // dönüşte görünürlük yeniden hesaplansın diye syncVisibility çağrılır.
  await prisma.cleanerBusiness.update({
    where: { id },
    data: { verification: "VERIFIED" },
  });
  await syncVisibility(id);

  await prisma.badge.upsert({
    where: { businessId_type: { businessId: id, type: "VERIFIED" } },
    create: { businessId: id, type: "VERIFIED" },
    update: {},
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/isletme/${id}`);
}

/**
 * Ödemesi (şimdilik havale/EFT) doğrulanan işletmeye 1 aylık ACTIVE dönem
 * açar; dönem hâlâ geçerliyse üstüne ekler (ardışık ödemeler birikir).
 * TODO(iyzico): kartlı ödeme canlıya alınınca bunu ödeme callback'i çağıracak.
 */
export async function activateSubscription(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  // Çift-tık koruması (denetim bulgusu): extendSubscription kümülatiftir
  // (+30 gün), buton iki kez basılırsa tek havale için 60 gün açılırdı.
  // Dönem sonu hâlâ 25+ gün ilerideyse "zaten aktif" say, tekrar uzatma.
  const sub = await prisma.subscription.findUnique({
    where: { businessId: id },
    select: { status: true, currentPeriodEnd: true },
  });
  const farEnough =
    sub?.currentPeriodEnd != null &&
    sub.currentPeriodEnd.getTime() > Date.now() + 25 * 24 * 60 * 60 * 1000;
  if (farEnough) {
    redirect(
      `/admin/isletme/${id}?mesaj=` +
        encodeURIComponent(
          "Abonelik zaten aktif (dönem sonu 25+ gün ileride). Tekrar uzatılmadı.",
        ),
    );
  }
  await extendSubscription(prisma, id); // havale/EFT — kartlı ödeme callback'iyle aynı mantık
  await syncVisibility(id); // ödeme sonrası profil tamsa yayına al
  revalidatePath("/admin");
  revalidatePath(`/admin/isletme/${id}`);
}

export async function rejectBusiness(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.cleanerBusiness.update({
    where: { id },
    data: { verification: "REJECTED", isVisible: false },
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/isletme/${id}`);
}

/**
 * Kullanıcı engelle (ban): giriş + mevcut oturum/token kilitlenir
 * (auth.ts bannedAt kontrolü). Şoförse mesaisi kapatılır; işletme
 * sahibiyse ilanı da yayından düşer. Admin kendini/başka admini engelleyemez.
 */
export async function banUser(formData: FormData) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") redirect("/giris");
  const userId = String(formData.get("userId"));
  const businessId = String(formData.get("businessId") ?? "");

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target || target.role === "ADMIN" || target.id === admin.id) {
    redirect(
      "/admin?hata=" +
        encodeURIComponent("Bu kullanıcı engellenemez (admin hesabı)."),
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: new Date() },
  });
  // Şoförse: mesaiden düşür (canlı konum akışı kesilsin)
  await prisma.driver.updateMany({
    where: { userId },
    data: { isOnShift: false },
  });
  // İşletme sahibiyse: ilan yayından düşsün
  const owned = await prisma.cleanerBusiness.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (owned) {
    await prisma.cleanerBusiness.update({
      where: { id: owned.id },
      data: { isVisible: false },
    });
  }
  revalidatePath("/admin");
  if (businessId) revalidatePath(`/admin/isletme/${businessId}`);
}

/** Engeli kaldır; işletme sahibiyse görünürlük yeniden hesaplanır. */
export async function unbanUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  const businessId = String(formData.get("businessId") ?? "");

  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: null },
  });
  const owned = await prisma.cleanerBusiness.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (owned) await syncVisibility(owned.id);
  revalidatePath("/admin");
  if (businessId) revalidatePath(`/admin/isletme/${businessId}`);
}

/** "Doğrulanmış" rozetini geri al (yayını etkilemez — rozet ayrı işaret). */
export async function revokeBadge(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.cleanerBusiness.update({
    where: { id },
    data: { verification: "PENDING" },
  });
  await prisma.badge.deleteMany({ where: { businessId: id, type: "VERIFIED" } });
  await syncVisibility(id);
  revalidatePath("/admin");
  revalidatePath(`/admin/isletme/${id}`);
}

/** Yayından kaldırmayı geri al (REJECTED → PENDING; görünürlük yeniden hesaplanır). */
export async function unrejectBusiness(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.cleanerBusiness.update({
    where: { id },
    data: { verification: "PENDING" },
  });
  await syncVisibility(id);
  revalidatePath("/admin");
  revalidatePath(`/admin/isletme/${id}`);
}

/** Aboneliği durdur: dönem hemen biter, işletme keşiften düşer (iade vb.). */
export async function suspendSubscription(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.subscription.updateMany({
    where: { businessId: id },
    data: { status: "CANCELED", currentPeriodEnd: new Date() },
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/isletme/${id}`);
}

/** İşletme sahibinin şifresini sıfırla: geçici şifre üretir, admin'e gösterir. */
export async function resetOwnerPassword(formData: FormData) {
  await requireAdmin();
  const businessId = String(formData.get("businessId"));
  const b = await prisma.cleanerBusiness.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  });
  if (!b) return;
  const temp = "Gecici-" + crypto.randomBytes(4).toString("hex");
  await prisma.user.update({
    where: { id: b.ownerId },
    // sessionsValidFrom: eski mobil token'ları geçersiz kıl (2026-07-28).
    data: { password: await hashPassword(temp), sessionsValidFrom: new Date() },
  });
  redirect(
    `/admin/isletme/${businessId}?mesaj=` +
      encodeURIComponent(
        `Geçici şifre: ${temp} — sahibine telefonla ilet, girişten sonra panelden değiştirsin.`,
      ),
  );
}

/** Uygunsuz fotoğrafı sil (moderasyon); foto şartı bozulursa yayından düşer. */
export async function deletePhoto(formData: FormData) {
  await requireAdmin();
  const photoId = String(formData.get("photoId"));
  const businessId = String(formData.get("businessId"));
  await prisma.businessPhoto.deleteMany({
    where: { id: photoId, businessId },
  });
  await syncVisibility(businessId);
  revalidatePath(`/admin/isletme/${businessId}`);
}

/** Uygunsuz yorumu sil (moderasyon) + işletme puan ortalamasını yeniden hesapla. */
export async function deleteReview(formData: FormData) {
  await requireAdmin();
  const reviewId = String(formData.get("reviewId"));
  const businessId = String(formData.get("businessId"));
  await prisma.review.deleteMany({ where: { id: reviewId, businessId } });
  const agg = await prisma.review.aggregate({
    where: { businessId },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.cleanerBusiness.update({
    where: { id: businessId },
    data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
  });
  revalidatePath(`/admin/isletme/${businessId}`);
}

/** Şoförü zorla mesaiden düşür (canlı konum akışı kesilir). */
export async function forceOffShift(formData: FormData) {
  await requireAdmin();
  const driverId = String(formData.get("driverId"));
  const businessId = String(formData.get("businessId") ?? "");
  await prisma.driver.updateMany({
    where: { id: driverId },
    data: { isOnShift: false },
  });
  if (businessId) revalidatePath(`/admin/isletme/${businessId}`);
  revalidatePath("/admin");
}

/** Admin içi not (işletme görmez): denetim gerekçeleri, görüşme kayıtları vb. */
export async function saveAdminNote(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const note = String(formData.get("note") ?? "").slice(0, 2000);
  await prisma.cleanerBusiness.update({
    where: { id },
    data: { adminNote: note || null },
  });
  revalidatePath(`/admin/isletme/${id}`);
}

// Tatil modunu admin kaldırır (işletme yanlışlıkla uzun süre kapattıysa /
// destek talebi geldiyse). Koymak paneldeki işletmenin kendi işi.
export async function clearPauseByAdmin(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.cleanerBusiness.update({
    where: { id },
    data: { pausedUntil: null },
  });
  revalidatePath(`/admin/isletme/${id}`);
  revalidatePath("/admin");
}


// ---- KOMİSYONCU (AGENT) yönetimi ----

/**
 * Komisyoncu hesabı oluştur (YALNIZ admin). Yüzde, hesap açılırken admin
 * tarafından belirlenir ve KDV HARİÇ net abonelik tutarı üzerinden işler.
 * Komisyoncu /komisyoncu sayfasında yalnız kendi kazançlarını görür.
 */
export async function createAgent(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const phone = normalizePhone(String(formData.get("phone") || ""));
  const usernameRaw = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const percentRaw = String(formData.get("percent") || "").replace(",", ".");
  // Premium yetkisi: kod üretirken istediği yüzde + sürede indirim tanımlayabilir.
  const canDiscount = formData.get("canDiscount") === "on";
  // BAŞ KOMİSYONCU (2026-07-25): kendi panelinden komisyoncu açar, havuz payının
  // altına verdiği yüzdenin FARKINI kendisi alır. Kendi kodundan getirdiği
  // işletmede havuzun tamamını alır → percent = poolPercent.
  const isHead = formData.get("isHead") === "on";
  const poolRaw = String(formData.get("poolPercent") || "").replace(",", ".");
  // Bölge: il + seçilen ilçeler (çoklu). Boş bırakılabilir — eski komisyoncular
  // bölgesiz duruyor, sonradan atanabiliyor.
  const bolge = bolgeOku(
    String(formData.get("territoryCity") || ""),
    formData.getAll("territoryDistrict").map((d) => String(d)),
  );
  const err = (m: string) =>
    redirect("/admin/komisyoncular?hata=" + encodeURIComponent(m));

  // İl seçilip ilçe seçilmediyse SESSİZCE geçme (denetim bulgusu): eskiden
  // hesap bölgesiz açılıp "oluşturuldu" deniyordu, kullanıcı fark etmiyordu.
  if (!bolge.ok) err(bolge.hata);
  if (name.length < 2) err("Ad girin.");
  if (!isTrPhone(phone)) err("Geçerli bir telefon girin (11 hane).");
  const username = normalizeUsername(usernameRaw);
  const uErr = validateUsername(username);
  if (uErr) err(uErr);
  if (password.length < 8) err("Şifre en az 8 karakter olmalı.");
  // Baş komisyoncuda tek sayı vardır: HAVUZ payı (kendi oranı = havuz).
  const poolPercent = isHead ? (poolRaw ? Number(poolRaw) : 50) : null;
  if (isHead && (!Number.isFinite(poolPercent!) || poolPercent! <= 0 || poolPercent! > 100))
    err("Havuz payı 0 ile 100 arasında olmalı (varsayılan 50).");
  const percent = isHead ? poolPercent! : Number(percentRaw);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100)
    err("Komisyon yüzdesi 0 ile 100 arasında olmalı (örn. 50).");
  const exists = await prisma.user.findFirst({
    where: { OR: [{ username }, { phone }] },
  });
  if (exists) {
    err(
      exists.username === username
        ? "Bu kullanıcı adı zaten kullanımda."
        : "Bu telefon zaten kayıtlı.",
    );
  }

  // TEK transaction (inceleme bulgusu): agent.create patlarsa yetim AGENT
  // kullanıcısı kalmasın; kod yarışında P2002 anlaşılır hataya çevrilir.
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
      const agent = await tx.agent.create({
        data: { userId: user.id, percent, canDiscount, isHead, poolPercent },
      });
      // BÖLGE (2026-07-28): hangi il/ilçelerden sorumlu. Çakışma engel değil,
      // form zaten dolu ilçeleri uyarıyla gösteriyor (bkz. lib/territory.ts).
      if (bolge.ok && bolge.city) {
        await tx.agentTerritory.createMany({
          data: bolge.districts.map((d: string) => ({
            agentId: agent.id,
            city: bolge.city as string,
            district: d,
          })),
          skipDuplicates: true,
        });
      }
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      err("Telefon/kullanıcı adı az önce başkası tarafından alındı — tekrar deneyin.");
    }
    throw e;
  }
  revalidatePath("/admin/komisyoncular");
  redirect("/admin/komisyoncular?ok=" + encodeURIComponent(username));
}

/** İşletmeye komisyoncu bağla/kaldır (admin işletme detayından, kodla). */
export async function setBusinessAgent(formData: FormData) {
  await requireAdmin();
  const businessId = String(formData.get("businessId") || "");
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const geri = "/admin/isletme/" + businessId;
  if (!businessId) redirect("/admin");

  const biz = await prisma.cleanerBusiness.findUnique({
    where: { id: businessId },
    select: { id: true, isDemo: true, discountPercent: true, discountUntil: true },
  });
  if (!biz) redirect("/admin");
  // DEMO panele komisyoncu kodu bağlanamaz (2026-07-30): demo zaten sahibi
  // olan komisyoncuya bağlıdır ve komisyon üretmez; kod bağlamak hem gerçek
  // bir kodu yakar hem "getirdiğim işletme" raporunu yalanlar.
  if (biz.isDemo) {
    redirect(
      geri +
        "?hata=" +
        encodeURIComponent("Bu bir DEMO panelidir — komisyoncu kodu bağlanamaz."),
    );
  }

  if (!code) {
    await prisma.cleanerBusiness.update({
      where: { id: businessId },
      data: { referredByAgentId: null },
    });
  } else {
    // TEK KULLANIMLIK kod: geçerli + kullanılmamış olmalı; bağlanınca yanar.
    const bulunan = await findUsableCode(code);
    if (!bulunan)
      redirect(
        geri +
          "?hata=" +
          encodeURIComponent(
            "Kod geçersiz, kullanılmış ya da komisyoncu pasif: " + code,
          ),
      );
    if (!(await claimCode(bulunan!.codeId)))
      redirect(geri + "?hata=" + encodeURIComponent("Kod az önce kullanıldı — komisyoncudan yeni kod isteyin."));
    // Koda gömülü indirim, işletmenin MEVCUT AKTİF indirimini EZMEZ (inceleme
    // bulgusu: %50/12 ay verilmişken %10/1 aylık kod bağlanınca taahhüt
    // sessizce küçülüyordu) — aktif indirim varsa korunur, admin'e söylenir.
    const kodluIndirim = Boolean(bulunan!.discountPercent && bulunan!.discountMonths);
    const mevcutAktif = activeDiscountPercent(biz!) != null;
    const uygula = kodluIndirim && !mevcutAktif;
    // Bağ + kod-iliştirme + indirim TEK transaction (yarım kalmasın).
    await prisma.$transaction([
      prisma.cleanerBusiness.update({
        where: { id: businessId },
        data: {
          referredByAgentId: bulunan!.agentId,
          ...(uygula
            ? {
                discountPercent: bulunan!.discountPercent,
                discountUntil: discountUntilFromMonths(bulunan!.discountMonths!),
                discountGrantedByAgentId: bulunan!.agentId, // yarısı ondan düşer
              }
            : {}),
        },
      }),
      prisma.agentReferralCode.update({
        where: { id: bulunan!.codeId },
        data: { usedByBusinessId: businessId },
      }),
    ]);
    if (kodluIndirim && mevcutAktif) {
      revalidatePath(geri);
      redirect(
        geri +
          "?mesaj=" +
          encodeURIComponent(
            "Komisyoncu bağlandı. İşletmenin mevcut aktif indirimi korundu — kodun indirimi işlenmedi.",
          ),
      );
    }
  }
  revalidatePath(geri);
  redirect(geri);
}

/** Komisyon kaydını ödendi/geri-al işaretle (admin). */
export async function toggleCommissionPaid(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const entry = await prisma.commissionEntry.findUnique({ where: { id } });
  if (entry) {
    // Koşullu yaz (TOCTOU): eşzamanlı iki tıklama niyetin tersine çevirmesin.
    await prisma.commissionEntry.updateMany({
      where: { id, paidAt: entry.paidAt ? { not: null } : null },
      data: { paidAt: entry.paidAt ? null : new Date() },
    });
  }
  revalidatePath("/admin/komisyoncular");
}

/** BAŞ komisyoncunun havuz farkı payını ödendi/geri-al işaretle (admin). */
export async function toggleHeadCommissionPaid(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const entry = await prisma.commissionEntry.findUnique({
    where: { id },
    select: { id: true, headPaidAt: true, headAgentId: true },
  });
  if (entry?.headAgentId) {
    // Koşullu yaz (TOCTOU): eşzamanlı iki tıklama niyetin tersine çevirmesin.
    await prisma.commissionEntry.updateMany({
      where: { id, headPaidAt: entry.headPaidAt ? { not: null } : null },
      data: { headPaidAt: entry.headPaidAt ? null : new Date() },
    });
  }
  revalidatePath("/admin/komisyoncular");
}

/** Komisyoncuyu pasife al / aktive et — pasifken YENİ tahakkuk işlemez.
 *  ADMIN dondurması ayrı bayrakla işaretlenir: baş komisyoncu kendi panelinden
 *  bunu geri açamaz (inceleme bulgusu — yönetici kararı geri alınabiliyordu). */
export async function toggleAgentActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (agent) {
    // Koşullu yaz (TOCTOU).
    await prisma.agent.updateMany({
      where: { id, active: agent.active },
      data: {
        active: !agent.active,
        // Pasife alıyorsak "admin dondurdu" işaretle; aktive ediyorsak kaldır.
        suspendedByAdmin: agent.active,
      },
    });
  }
  revalidatePath("/admin/komisyoncular");
}

/** Komisyon oranı düzeltme (admin): alt komisyoncunun yüzdesi ya da baş
 *  komisyoncunun havuz payı. Yanlış girilen oran kalıcı olmasın (inceleme
 *  bulgusu). Geçmiş tahakkuklar DEĞİŞMEZ — CommissionEntry.percent o anki
 *  oranı saklar; yeni oran bundan sonraki ödemelerde geçerlidir. */
export async function updateAgentPercent(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const raw = String(formData.get("percent") || "").replace(",", ".").trim();
  const err = (m: string) =>
    redirect("/admin/komisyoncular?hata=" + encodeURIComponent(m));

  const agent = await prisma.agent.findUnique({
    where: { id },
    select: {
      id: true,
      isHead: true,
      parentId: true,
      children: { select: { percent: true } },
      parent: { select: { poolPercent: true } },
    },
  });
  if (!agent) err("Komisyoncu bulunamadı.");
  const yeni = Number(raw);
  if (!Number.isFinite(yeni) || yeni <= 0 || yeni > 100)
    err("Oran 0 ile 100 arasında olmalı.");

  if (agent!.isHead) {
    // HAVUZ PAYI düşürülüyorsa altındaki en yüksek yüzdenin ALTINA inemez —
    // yoksa o alt komisyoncu havuzdan fazla alır (kural 3 ihlali).
    const enYuksekAlt = agent!.children.reduce(
      (m, c) => Math.max(m, Number(c.percent)),
      0,
    );
    if (yeni < enYuksekAlt)
      err(
        `Havuz payı, ekipteki en yüksek komisyoncu oranının (%${enYuksekAlt}) altına indirilemez — önce onun oranını düşürün.`,
      );
    await prisma.agent.update({
      where: { id: agent!.id },
      // Baş komisyoncunun kendi oranı = havuz payı (kendi kodundan tamamını alır).
      data: { poolPercent: yeni, percent: yeni },
    });
  } else {
    // ALT komisyoncu: başının havuz payını AŞAMAZ.
    const havuz = Number(agent!.parent?.poolPercent ?? 0);
    if (agent!.parentId && yeni > havuz)
      err(`Bu komisyoncuya en fazla %${havuz} verilebilir (baş komisyoncunun havuz payı).`);
    await prisma.agent.update({
      where: { id: agent!.id },
      data: { percent: yeni },
    });
  }
  revalidatePath("/admin/komisyoncular");
  redirect("/admin/komisyoncular?ok=" + encodeURIComponent("oran güncellendi"));
}

/** Premium (indirim tanımlama) yetkisini aç/kapat. Kapatınca mevcut kodlardaki
 *  ve işletmelere işlenmiş indirimler DURMAZ (verilmiş söz tutulur) — yalnız
 *  yeni indirimlı kod üretemez. */
export async function toggleAgentDiscount(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (agent) {
    // Koşullu yaz (TOCTOU).
    await prisma.agent.updateMany({
      where: { id, canDiscount: agent.canDiscount },
      data: { canDiscount: !agent.canDiscount },
    });
  }
  revalidatePath("/admin/komisyoncular");
}

/** ADMIN indirim yetkisi (işletme detayından): yüzde + kaç ay — sınırsız.
 *  Yüzde boş/0 = indirimi kaldır. Süre HER kayıtta ŞİMDİDEN itibaren yeniden
 *  hesaplanır (uzatmak için tekrar kaydet yeter). */
export async function setBusinessDiscount(formData: FormData) {
  await requireAdmin();
  const businessId = String(formData.get("businessId") || "");
  const geri = "/admin/isletme/" + businessId;
  if (!businessId) redirect("/admin");
  const biz = await prisma.cleanerBusiness.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!biz) redirect("/admin");

  const pctRaw = String(formData.get("percent") || "").replace(",", ".").trim();
  const ayRaw = String(formData.get("months") || "").trim();

  if (!pctRaw || Number(pctRaw) === 0) {
    await prisma.cleanerBusiness.update({
      where: { id: businessId },
      data: {
        discountPercent: null,
        discountUntil: null,
        discountGrantedByAgentId: null,
      },
    });
    revalidatePath(geri);
    redirect(geri + "?mesaj=" + encodeURIComponent("İndirim kaldırıldı."));
  }
  const pct = Number(pctRaw);
  const ay = Number(ayRaw);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100)
    redirect(geri + "?hata=" + encodeURIComponent("İndirim yüzdesi 1-100 arasında olmalı."));
  if (!Number.isInteger(ay) || ay < 1 || ay > 1200)
    redirect(geri + "?hata=" + encodeURIComponent("İndirim süresi ay olarak girilmeli (en az 1)."));
  const pctYuvarlak = Math.round(pct * 100) / 100;
  await prisma.cleanerBusiness.update({
    where: { id: businessId },
    data: {
      discountPercent: pctYuvarlak,
      discountUntil: discountUntilFromMonths(ay),
      // Admin indirimi: yükü tamamen platform taşır, komisyoncu cezalanmaz.
      discountGrantedByAgentId: null,
    },
  });
  revalidatePath(geri);
  redirect(
    geri +
      "?mesaj=" +
      encodeURIComponent(
        `İndirim kaydedildi: %${pctYuvarlak.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}, ${ay} ay.`,
      ),
  );
}

// ---- KOMİSYON ÖDEME (ÇEKİM) TALEPLERİ — 2026-07-26 ----
// Komisyoncu talep oluşturur, havaleyi ADMIN elle yapar, sonra burada işaretler.
// "Ödendi" işareti o ana kadarki TÜM ödenmemiş tahakkukları kapatır (lib/payout).

export async function payoutMarkPaid(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const not = String(formData.get("adminNote") || "");
  const { markPayoutPaid } = await import("@/lib/payout");
  const r = await markPayoutPaid(id, not);
  revalidatePath("/admin/komisyoncular");
  if (!r.ok) {
    redirect("/admin/komisyoncular?hata=" + encodeURIComponent(r.hata ?? "Ödeme işaretlenemedi."));
  }
  const tl = (n: number) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: 2 });
  redirect(
    "/admin/komisyoncular?ok=" +
      encodeURIComponent(
        r.stopaj != null
          ? `${tl(r.tutar ?? 0)} TL brüt kapatıldı — stopaj ${tl(r.stopaj)} TL otomatik kaydedildi, HAVALEYİ NET ${tl(r.net ?? 0)} TL YAP (gider pusulasını yazdırmayı unutma)`
          : `${tl(r.tutar ?? 0)} TL ödendi olarak işaretlendi`,
      ),
  );
}

/** Komisyoncunun "fatura mükellefi" durumunu değiştir (2026-07-31).
 *  Mükellef = ödemeye fatura keser, stopaj UYGULANMAZ. Kapatınca eşik aşan
 *  ödemelerde stopaj otomatik hesaplanır. */
export async function toggleFaturaMukellefi(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { faturaMukellefi: true, user: { select: { name: true } } },
  });
  if (!agent) redirect("/admin/komisyoncular?hata=" + encodeURIComponent("Komisyoncu bulunamadı."));
  await prisma.agent.update({
    where: { id: agentId },
    data: { faturaMukellefi: !agent!.faturaMukellefi },
  });
  revalidatePath("/admin/komisyoncular");
  redirect(
    "/admin/komisyoncular?ok=" +
      encodeURIComponent(
        agent!.faturaMukellefi
          ? `${agent!.user.name} artık fatura mükellefi DEĞİL — eşik aşan ödemelerde stopaj otomatik kesilecek.`
          : `${agent!.user.name} fatura mükellefi olarak işaretlendi — stopaj uygulanmaz, ödemeye fatura istenir.`,
      ),
  );
}

export async function payoutReject(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const sebep = String(formData.get("adminNote") || "").trim();
  // Koşullu yaz: yalnız hâlâ bekleyen talep reddedilebilir (TOCTOU).
  await prisma.payoutRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED", adminNote: sebep || "Reddedildi" },
  });
  revalidatePath("/admin/komisyoncular");
}


/**
 * KOMİSYONCUNUN BÖLGESİNİ GÜNCELLE (admin) — 2026-07-28 denetim bulgusu.
 *
 * Bölge yalnız hesap AÇILIŞINDA yazılabiliyordu: sonradan atama, değiştirme ya
 * da kaldırma yolu yoktu. Mevcut komisyoncular (bölge sisteminden önce açılmış
 * olanlar) bu yüzden sonsuza dek bölgesiz kalıyordu; üstelik alt komisyoncunun
 * bölge sayfası "atandığında burada görünecek" diye tutulamayacak bir söz
 * veriyordu. Bu aksiyon o boşluğu kapatır.
 *
 * Gönderilen ilçe kümesi bölgenin TAMAMIDIR (ekle-çıkar değil, değiştir):
 * seçilmeyenler silinir. Boş gönderim = bölgeyi kaldır.
 */
export async function setAgentTerritory(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  const err = (m: string) =>
    redirect("/admin/komisyoncular?hata=" + encodeURIComponent(m));
  if (!agentId) err("Komisyoncu bulunamadı.");

  const bolge = bolgeOku(
    String(formData.get("territoryCity") || ""),
    formData.getAll("territoryDistrict").map((d) => String(d)),
  );
  if (!bolge.ok) err(bolge.hata);

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true },
  });
  if (!agent) err("Komisyoncu bulunamadı.");

  // Tek transaction: eskiyi sil, yeniyi yaz. Yarım kalırsa bölge bozulmasın.
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
  revalidatePath("/admin/komisyoncular");
  revalidatePath("/admin/bolgeler");
  redirect("/admin/komisyoncular?ok=" + encodeURIComponent("Bölge güncellendi"));
}
