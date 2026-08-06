"use server";

// ÇALIŞAN HESAPLARI — İŞLETME SAHİBİ YÖNETİR (2026-08-06).
//
// Şoför aksiyonlarının (panel/actions.ts addDriver/removeDriver/...) birebir
// ikizidir; bilerek aynı desen: aynı doğrulamalar, aynı hata metinleri, aynı
// `sessionsValidFrom` damgası. İki ayrı desen olsaydı biri güncellenip öteki
// unutulurdu — bu depoda tam bu hata sipariş bildirimlerinde yaşandı.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { hashPassword } from "@/lib/auth";
import { normalizePhone, isMobilePhone } from "@/lib/phone";
import { normalizeUsername, validateUsername } from "@/lib/username";

/**
 * SAHİBE ÖZEL bağlam. `getCurrentBusiness()` yalnız CLEANER kabul eder →
 * çalışan bu dosyadaki HİÇBİR aksiyonu çağıramaz (kendine yetki veremez,
 * arkadaşına hesap açamaz, patronun şifresini değiştiremez).
 */
async function biz() {
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");
  return b;
}

export async function addStaff(formData: FormData) {
  const b = await biz();
  const name = String(formData.get("name") || "").trim();
  const phone = normalizePhone(String(formData.get("phone") || ""));
  const chosen = String(formData.get("password") || "");
  const username = normalizeUsername(String(formData.get("username") || ""));

  if (!name) throw new Error("Ad soyad girin.");
  if (!isMobilePhone(phone)) {
    throw new Error("Telefon 05xx ile başlayan 11 hane olmalı.");
  }
  const usernameError = validateUsername(username);
  if (usernameError) throw new Error(usernameError);
  if (chosen.length < 8) throw new Error("Şifre en az 8 karakter olmalı.");

  const exists = await prisma.user.findFirst({
    where: { OR: [{ phone }, { username }] },
    select: { username: true },
  });
  if (exists) {
    throw new Error(
      exists.username === username
        ? "Bu kullanıcı adı alınmış. Başka bir tane seçin."
        : "Bu telefon numarası başka bir hesapta zaten kayıtlı.",
    );
  }

  const password = await hashPassword(chosen);
  const user = await prisma.user.create({
    data: { role: "STAFF", name, phone, username, password },
  });
  await prisma.staff.create({ data: { userId: user.id, businessId: b.id } });

  revalidatePath("/panel/calisanlar");
}

export async function removeStaff(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id"));
  // Yalnız BU işletmenin çalışanı silinebilir.
  const s = await prisma.staff.findFirst({
    where: { id, businessId: b.id },
    select: { id: true, userId: true },
  });
  if (!s) return;
  // Kullanıcıyı da sil: STAFF hesabının işletmesiz hiçbir anlamı yok, ortada
  // kalırsa /panel'e girip `getPanelErisim()` null döndüğü için /giris'e
  // düşen "ölü" bir hesap olurdu.
  await prisma.user.delete({ where: { id: s.userId } });
  revalidatePath("/panel/calisanlar");
}

/** Çalışan şifresini sahibi belirler/sıfırlar (şoförle aynı kural). */
export async function setStaffPassword(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id"));
  const pw = String(formData.get("password") || "");
  if (pw.length < 8) throw new Error("Şifre en az 8 karakter olmalı.");
  const s = await prisma.staff.findFirst({
    where: { id, businessId: b.id },
    select: { userId: true },
  });
  if (!s) return;
  await prisma.user.update({
    where: { id: s.userId },
    data: {
      password: await hashPassword(pw),
      // İşten çıkarılan / şifresi sıfırlanan çalışanın telefonundaki 30 günlük
      // Bearer token'ı ANINDA geçersiz kılar (şoförde olduğu gibi — 2026-07-28).
      sessionsValidFrom: new Date(),
    },
  });
  revalidatePath("/panel/calisanlar");
}

/** Çalışanın giriş kimliği (kullanıcı adı) — e-postası yok, tek kimliği bu. */
export async function setStaffUsername(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id"));
  const username = normalizeUsername(String(formData.get("username") || ""));
  const err = validateUsername(username);
  if (err) throw new Error(err);
  const s = await prisma.staff.findFirst({
    where: { id, businessId: b.id },
    select: { userId: true },
  });
  if (!s) return;
  const taken = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (taken && taken.id !== s.userId) {
    throw new Error("Bu kullanıcı adı alınmış. Başka bir tane seçin.");
  }
  await prisma.user.update({ where: { id: s.userId }, data: { username } });
  revalidatePath("/panel/calisanlar");
}
