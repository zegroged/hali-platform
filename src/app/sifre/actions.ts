"use server";

import { redirect } from "next/navigation";
import {
  getSessionUser,
  hashPassword,
  verifyPassword,
  demoBiletiVarMi,
  createSession,
} from "@/lib/auth";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/ratelimit";

// KENDİ ŞİFRESİNİ DEĞİŞTİRME — TÜM ROLLER (2026-08-02).
// Şifre tek yerde (User.password) yaşadığı için bu tek action komisyoncu,
// işletme sahibi, şoför, mali müşavir, admin ve müşteriyi birden kapsar.
// sessionsValidFrom damgası ARTIK ÇEREZİ DE düşürüyor (2026-08-07 denetimi,
// madde 1: eskiden yalnız mobil Bearer düşüyordu, çerez içeride kalıyordu —
// hesabı ele geçiren biri şifre değişse bile oturumda kalabiliyordu).
// Bu yüzden kendi şifresini değiştiren kullanıcıya HEMEN yeni oturum
// veriliyor: damgadan SONRA üretilen jeton geçerlidir, kullanıcı atılmaz.
// Onun DİĞER cihazlarındaki oturumlar ise (doğru biçimde) düşer.
export async function changeOwnPassword(formData: FormData) {
  const u = await getSessionUser();
  if (!u) redirect("/giris");
  const hataDon = (m: string): never => {
    redirect("/sifre?hata=" + encodeURIComponent(m));
  };

  // DEMO OTURUMU (2026-08-02 denetim): komisyoncu tek tıkla girdiği demo
  // hesabının şifresini değiştirebiliyordu; şifre lib/demoPanel.ts'te
  // TÜRETİLDİĞİ için panelde gösterilen kutu bayatlıyor ve demo bir daha elle
  // açılamıyordu. Demo hesaplarında bu sayfa kapalı.
  const demoda = await demoBiletiVarMi();
  if (demoda)
    redirect(
      "/sifre?hata=" +
        encodeURIComponent(
          "Demo hesabındasın — demo şifresi değiştirilemez. Kendi hesabına dön, oradan değiştir.",
        ),
    );

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
  // Damga şimdi ÇEREZİ de geçersiz kılıyor → kendini atmamak için tazele.
  // (createSession demo biletini de siler; şifre değişiminde bu zaten istenen
  // davranış — bkz. demoBiletiTemizle çağrıları.)
  await createSession(u.id);
  redirect("/sifre?ok=1");
}

// ---------------------------------------------------------------- E-POSTA
//
// DERT (2026-08-02, kullanıcı): komisyoncu hesapları e-postasız açılıyor;
// şifresini unutan komisyoncu "şifremi unuttum" akışını kullanamıyor.
//
// ÇÖZÜM: herkes bu sayfadan kendi e-postasını ekleyip 6 haneli kodla
// doğrulayabilir. Doğrulanmadan User.email YAZILMAZ — yoksa yanlış/başkasının
// adresi hesaba bağlanır ve o adres şifre sıfırlayabilirdi.
export async function sendEmailCode(formData: FormData) {
  const u = await getSessionUser();
  if (!u) redirect("/giris");
  const hataDon = (m: string): never => {
    redirect("/sifre?hata=" + encodeURIComponent(m));
  };
  if (await demoBiletiVarMi())
    hataDon("Demo hesabında e-posta değiştirilemez — kendi hesabına dön.");

  const eposta = String(formData.get("eposta") || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(eposta))
    hataDon("Geçerli bir e-posta adresi yaz.");
  const rl = rateLimit(`eposta-kod:${u.id}`, 5, 60 * 60 * 1000);
  if (!rl.ok) hataDon("Çok fazla kod istedin — bir saat sonra tekrar dene.");

  // Adres başkasına bağlıysa devralınamaz.
  const baskasi = await prisma.user.findFirst({
    where: { email: eposta, NOT: { id: u.id } },
    select: { id: true },
  });
  if (baskasi) hataDon("Bu e-posta başka bir hesapta kayıtlı.");

  const kod = String(crypto.randomInt(100000, 1000000));
  await prisma.signupOtp.upsert({
    where: { email: eposta },
    create: {
      email: eposta,
      code: kod,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
    update: {
      code: kod,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
    },
  });
  try {
    await sendVerificationEmail(eposta, kod);
  } catch (e) {
    console.error("eposta kodu gonderilemedi:", e);
    hataDon("Kod gönderilemedi — adresi kontrol edip tekrar dene.");
  }
  redirect(
    "/sifre?bekleyen=" +
      encodeURIComponent(eposta) +
      "&ok=" +
      encodeURIComponent(`${eposta} adresine 6 haneli kod gönderildi.`),
  );
}

/** Kodu doğrula ve e-postayı hesaba bağla. */
export async function verifyEmailCode(formData: FormData) {
  const u = await getSessionUser();
  if (!u) redirect("/giris");
  const eposta = String(formData.get("eposta") || "").trim().toLowerCase();
  const kod = String(formData.get("kod") || "").trim();
  const hataDon = (m: string): never => {
    redirect(
      "/sifre?bekleyen=" + encodeURIComponent(eposta) + "&hata=" + encodeURIComponent(m),
    );
  };

  const otp = await prisma.signupOtp.findUnique({ where: { email: eposta } });
  if (!otp) hataDon("Kod bulunamadı — yeniden kod iste.");
  if (otp!.expiresAt.getTime() < Date.now()) hataDon("Kodun süresi doldu (10 dk).");
  if (otp!.attempts >= 5) hataDon("Çok fazla yanlış deneme — yeniden kod iste.");
  if (otp!.code !== kod) {
    await prisma.signupOtp.update({
      where: { email: eposta },
      data: { attempts: { increment: 1 } },
    });
    hataDon("Kod yanlış.");
  }
  // Yarış: kod doğrulanana kadar adres başkasına bağlanmış olabilir.
  const baskasi = await prisma.user.findFirst({
    where: { email: eposta, NOT: { id: u.id } },
    select: { id: true },
  });
  if (baskasi) hataDon("Bu e-posta başka bir hesapta kayıtlı.");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: u.id },
      data: { email: eposta, emailVerified: true },
    }),
    prisma.signupOtp.delete({ where: { email: eposta } }),
  ]);
  redirect(
    "/sifre?ok=" +
      encodeURIComponent(
        `E-postan doğrulandı: ${eposta}. Şifreni unutursan giriş sayfasındaki "Şifremi unuttum" ile bu adresten yenileyebilirsin.`,
      ),
  );
}
