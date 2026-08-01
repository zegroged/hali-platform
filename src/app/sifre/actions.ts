"use server";

import { redirect } from "next/navigation";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";

// KENDİ ŞİFRESİNİ DEĞİŞTİRME — TÜM ROLLER (2026-08-02).
// Şifre tek yerde (User.password) yaşadığı için bu tek action komisyoncu,
// işletme sahibi, şoför, mali müşavir, admin ve müşteriyi birden kapsar.
// sessionsValidFrom damgası mobil Bearer token'ları düşürür; web çerezi
// kontrol edilmediğinden (auth.ts getSessionUser) kullanıcı bu oturumda
// içeride kalır — yeniden giriş gerekmez, mobilde gerekir.
export async function changeOwnPassword(formData: FormData) {
  const u = await getSessionUser();
  if (!u) redirect("/giris");
  const hataDon = (m: string): never => {
    redirect("/sifre?hata=" + encodeURIComponent(m));
  };

  const rl = rateLimit(`sifre-degistir:${u.id}`, 5, 15 * 60 * 1000);
  if (!rl.ok)
    hataDon(
      `Çok fazla deneme — ${Math.max(1, Math.ceil(rl.retryAfterSec / 60))} dakika sonra tekrar dene.`,
    );

  const eski = String(formData.get("eski") || "");
  const yeni = String(formData.get("yeni") || "");
  const tekrar = String(formData.get("tekrar") || "");
  if (yeni.length < 8) hataDon("Yeni şifre en az 8 karakter olmalı.");
  if (yeni.length > 72) hataDon("Yeni şifre en fazla 72 karakter olabilir.");
  if (yeni !== tekrar) hataDon("Yeni şifre ile tekrarı aynı değil.");
  if (yeni === eski) hataDon("Yeni şifre eskisiyle aynı olamaz.");

  const user = await prisma.user.findUnique({
    where: { id: u.id },
    select: { password: true },
  });
  if (!user?.password)
    redirect(
      "/sifre?hata=" +
        encodeURIComponent("Hesabında şifre tanımlı değil — yöneticiyle görüş."),
    );
  if (!(await verifyPassword(eski, user.password)))
    hataDon("Mevcut şifren yanlış.");

  await prisma.user.update({
    where: { id: u.id },
    data: { password: await hashPassword(yeni), sessionsValidFrom: new Date() },
  });
  redirect("/sifre?ok=1");
}
