"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { profileComplete, syncVisibility } from "@/lib/panel";
import { PERIOD_DAYS } from "@/lib/subscription";

async function requireAdmin() {
  const u = await getSessionUser();
  if (!u || u.role !== "ADMIN") redirect("/giris");
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
  const existing = await prisma.subscription.findUnique({
    where: { businessId: id },
  });
  const base =
    existing?.currentPeriodEnd &&
    existing.currentPeriodEnd.getTime() > Date.now()
      ? existing.currentPeriodEnd
      : new Date();
  const end = new Date(base.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);
  await prisma.subscription.upsert({
    where: { businessId: id },
    create: {
      businessId: id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: end,
    },
    update: { status: "ACTIVE", currentPeriodEnd: end },
  });
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
