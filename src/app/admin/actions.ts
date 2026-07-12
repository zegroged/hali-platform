"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { profileComplete, syncVisibility } from "@/lib/panel";
import { extendSubscription } from "@/lib/subscription";
import { taxIdError } from "@/lib/taxId";
import { normalizeCityName, normalizeDistrictName } from "@/lib/cities";
import { normalizeUsername, validateUsername } from "@/lib/username";
import { saveObject } from "@/lib/storage";
import { CONTRACT_VERSION } from "@/lib/legal";

async function requireAdmin() {
  const u = await getSessionUser();
  if (!u || u.role !== "ADMIN") redirect("/giris");
}

// Admin'in ilçe koordinatı çözmesi (kayıt route'uyla aynı; erişilemezse İstanbul).
async function geocodeDistrict(district: string, city: string) {
  try {
    const res = await fetch(
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=" +
        encodeURIComponent(`${district}, ${city}`),
      {
        headers: { "User-Agent": "HaliYikamaPlatformu/1.0", "Accept-Language": "tr" },
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
  const phone = String(formData.get("phone") || "").replace(/\D/g, "");
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
  const pricePerM2 = Number(formData.get("pricePerM2")) || null;
  const minDays = Number(formData.get("minDays")) || null;
  const maxDays = Number(formData.get("maxDays")) || null;
  // Opsiyonel ilk şoför — yayın şartı (foto + ≥1 şoför) tek ekranda tamamlansın.
  const dName = String(formData.get("driverName") || "").trim();
  const dPhone = String(formData.get("driverPhone") || "").replace(/\D/g, "");
  const dUsername = normalizeUsername(String(formData.get("driverUsername") || ""));
  const dPassword = String(formData.get("driverPassword") || "");
  const wantsDriver = Boolean(dName || dPhone || dUsername || dPassword);
  // İşletme fotoğrafları (jpg/png/webp, ≤5MB/adet; action gövdesi toplam 8MB).
  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 10);

  const err = (msg: string) =>
    redirect(formPath + "?hata=" + encodeURIComponent(msg));

  if (businessName.length < 2 || ownerName.length < 2)
    err("İşletme adı ve yetkili adı gerekli.");
  if (!/^05\d{9}$/.test(phone)) err("Telefon 05xx ile 11 hane olmalı.");
  if (!/^\S+@\S+\.\S+$/.test(email)) err("Geçerli bir e-posta gerekli.");
  if (password.length < 8) err("Şifre en az 8 karakter olmalı.");
  const username = usernameRaw ? normalizeUsername(usernameRaw) : null;
  if (username) {
    const uErr = validateUsername(username);
    if (uErr) err(uErr);
  }
  if (!city || !district) err("İl ve ilçe listeden seçilmeli.");
  const taxErr = taxIdError(taxNumber);
  if (taxErr) err("Vergi/kimlik no: " + taxErr);
  if (wantsDriver) {
    // Şoför alanlarından biri doldurulduysa hepsi gerekli (yarım hesap olmasın).
    if (dName.length < 2) err("Şoför adı gerekli.");
    if (!/^05\d{9}$/.test(dPhone))
      err("Şoför telefonu 05xx ile 11 hane olmalı.");
    const dErr = validateUsername(dUsername);
    if (dErr) err("Şoför kullanıcı adı: " + dErr);
    if (dPassword.length < 8) err("Şoför şifresi en az 8 karakter olmalı.");
    if (dUsername === username)
      err("Şoförün kullanıcı adı işletme sahibininkiyle aynı olamaz.");
    if (dPhone === phone) err("Şoför telefonu işletme telefonuyla aynı olamaz.");
  }

  const exists = await prisma.user.findFirst({
    where: { OR: [{ phone }, { email }] },
    select: { id: true },
  });
  if (exists) err("Bu telefon veya e-posta ile zaten bir hesap var.");
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

  const { lat, lng } = await geocodeDistrict(district, city);
  const farFuture = new Date("2099-12-31T00:00:00.000Z"); // süresiz ücretsiz

  const owner = await prisma.user.create({
    data: {
      role: "CLEANER",
      name: ownerName,
      phone,
      username, // opsiyonel — yoksa sahibi ilk girişte belirler (/kullanici-adi)
      email,
      emailVerified: true, // admin açtı — e-posta doğrulaması atlanır
      password: await hashPassword(password),
      ownedBusiness: {
        create: {
          name: businessName,
          address: `${district}, ${city}`,
          city,
          district,
          lat,
          lng,
          phone,
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
          verification: "VERIFIED", // doğrulama kapısı yok
          isVisible: false, // syncVisibility hesaplar (foto+şoför gelince açılır)
          contractAcceptedAt: new Date(),
          contractVersion: CONTRACT_VERSION,
          adminNote: `${isSupport ? "Müşteri Hizmetleri" : "Admin"} (${admin.name}) tarafından açıldı — süresiz ücretsiz abonelik.`,
          serviceAreas: { create: [{ city, district }] },
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
  for (const file of photos) {
    const rawExt = PHOTO_TYPES[file.type];
    if (!rawExt || file.size > 5 * 1024 * 1024) continue;
    const original = Buffer.from(await file.arrayBuffer());
    let buf = original;
    let contentType = file.type;
    try {
      buf = await sharp(original)
        .rotate()
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      contentType = "image/webp";
    } catch {
      // sharp hata verirse orijinal dosyaya düş
    }
    const ext = contentType === "image/webp" ? "webp" : rawExt;
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const url = await saveObject(`uploads/${businessId}/${name}`, buf, contentType);
    await prisma.businessPhoto.create({
      data: { businessId, url, isBefore: false, isAfter: true },
    });
  }

  await syncVisibility(businessId); // foto+şoför varsa hemen yayına al
  revalidatePath("/admin");
  // Giriş kimliği: e-posta (+ girildiyse kullanıcı adı) + belirlenen şifre.
  const girisKimlik = username ? `${email} veya kullanıcı adı "${username}"` : email;
  const mesaj = encodeURIComponent(
    `İşletme oluşturuldu. Giriş: ${girisKimlik} · belirlediğin şifre (sahibine ilet).` +
      (username ? "" : " İlk girişte kullanıcı adı belirleyecek.") +
      (wantsDriver
        ? ` Şoför girişi: kullanıcı adı "${dUsername}" · belirlediğin şoför şifresi.`
        : " Yayın için en az bir şoför eklenmeli.") +
      (photos.length === 0 ? " Yayın için fotoğraf da gerekli." : ""),
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
    data: { password: await hashPassword(temp) },
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
