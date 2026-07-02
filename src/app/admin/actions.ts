"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { profileComplete } from "@/lib/panel";
import { TRIAL_DAYS } from "@/lib/subscription";

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
    throw new Error("Profili tamamlanmamış işletme onaylanamaz.");
  }

  await prisma.cleanerBusiness.update({
    where: { id },
    data: { verification: "VERIFIED", isVisible: true },
  });

  // Onayda 30 günlük TRIAL abonelik başlat (yoksa). Sipariş alabilmesi buna bağlı.
  await prisma.subscription.upsert({
    where: { businessId: id },
    create: {
      businessId: id,
      status: "TRIAL",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    },
    update: {}, // mevcut aboneliğe dokunma
  });

  await prisma.badge.upsert({
    where: { businessId_type: { businessId: id, type: "VERIFIED" } },
    create: { businessId: id, type: "VERIFIED" },
    update: {},
  });
  revalidatePath("/admin");
}

export async function rejectBusiness(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.cleanerBusiness.update({
    where: { id },
    data: { verification: "REJECTED", isVisible: false },
  });
  revalidatePath("/admin");
}
