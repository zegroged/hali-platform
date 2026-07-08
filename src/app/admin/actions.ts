"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
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
