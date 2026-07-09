"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { normalizeUsername, validateUsername } from "@/lib/username";

const ROLE_HOME: Record<string, string> = {
  CLEANER: "/panel",
  DRIVER: "/sofor",
  ADMIN: "/admin",
  SUPPORT: "/destek",
  CUSTOMER: "/",
};

/**
 * Kullanıcı adı olmayan (telefonla giriş döneminden kalan) hesaplar için
 * tek seferlik belirleme. Zaten kullanıcı adı varsa DEĞİŞTİRMEZ — bu akış
 * "kullanıcı adı değiştirme" değil, eksik kimliği tamamlama adımıdır.
 */
export async function setMyUsername(formData: FormData) {
  const u = await getSessionUser();
  if (!u) redirect("/giris");
  if (u.username) redirect(ROLE_HOME[u.role] ?? "/"); // zaten var → geri dön

  const username = normalizeUsername(String(formData.get("username") || ""));
  const err = validateUsername(username);
  const fail = (msg: string) =>
    redirect("/kullanici-adi?hata=" + encodeURIComponent(msg));
  if (err) fail(err);

  const taken = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (taken) fail("Bu kullanıcı adı alınmış. Başka bir tane seçin.");

  try {
    await prisma.user.update({
      where: { id: u.id },
      data: { username },
    });
  } catch {
    // Yarış durumu: aradaki milisaniyede başkası aynı adı aldı (unique kısıt).
    fail("Bu kullanıcı adı az önce alındı. Başka bir tane seçin.");
  }

  revalidatePath("/", "layout");
  redirect(ROLE_HOME[u.role] ?? "/");
}
