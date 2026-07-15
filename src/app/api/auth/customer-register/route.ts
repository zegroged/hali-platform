import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession, signSession } from "@/lib/auth";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

// Müşteri (üye) kaydı: yorum yapabilmek + puan biriktirmek için. Kayıt öncesi
// e-posta OTP (request-code) doğrulanır → hesap yalnız posta kutusuna erişenle
// kurulur. Sipariş vermek için üyelik ZORUNLU DEĞİL; yalnız yorum için gerekir.
const Body = z.object({
  name: z.string().trim().min(2, "Ad soyad gerekli.").max(60),
  email: z.string().trim().email("Geçerli bir e-posta gerekli.").max(120),
  phone: z.string().regex(/^05\d{9}$/, "Telefon 05xx ile 11 hane olmalı."),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı.").max(72),
  emailCode: z.string().trim().length(6, "6 haneli kodu gir."),
  // Honeypot (bot tuzağı)
  website: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`customer-register:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Eksik veya hatalı bilgi." },
      { status: 400 },
    );
  }
  const { name, phone, password, emailCode } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  if (parsed.data.website) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  // E-posta doğrulama kodu kontrolü (register akışıyla aynı SignupOtp tablosu).
  const otp = await prisma.signupOtp.findUnique({ where: { email } });
  if (!otp || otp.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Doğrulama kodunun süresi dolmuş — yeni kod isteyin." },
      { status: 400 },
    );
  }
  if (otp.attempts >= 5) {
    return NextResponse.json(
      { error: "Çok fazla yanlış deneme — yeni kod isteyin." },
      { status: 429 },
    );
  }
  if (otp.code !== emailCode) {
    await prisma.signupOtp.update({
      where: { email },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "Doğrulama kodu hatalı." }, { status: 400 });
  }

  // Çakışma kontrolü OTP silinmeden önce (kod boşa yanmasın).
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { email: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          existing.email === email
            ? "Bu e-posta ile zaten bir hesap var. Giriş yapın."
            : "Bu telefon numarasıyla zaten bir hesap var. Giriş yapın.",
      },
      { status: 409 },
    );
  }

  await prisma.signupOtp.delete({ where: { email } });

  const user = await prisma.user.create({
    data: {
      role: "CUSTOMER",
      name,
      phone,
      email,
      emailVerified: true, // kayıt öncesi kodla doğrulandı
      password: await hashPassword(password),
    },
    select: { id: true },
  });

  // Geçmişte misafir olarak verilmiş siparişleri bu hesaba bağla — AMA yalnız
  // OTP ile DOĞRULANMIŞ e-posta eşleşmesiyle (sahiplik kanıtı). Telefonla
  // bağlamak GÜVENSİZDİ: SMS mock olduğundan telefon kanıtlanamıyor, saldırgan
  // kurbanın telefonunu yazıp kendi e-postasıyla kayıt olarak kurbanın
  // adres/GPS/foto verisini ele geçirebiliyordu (denetim bulgusu). E-posta
  // sipariş formunda opsiyonel; girmemiş misafir siparişi bağlanmaz (kayıp
  // değil — kullanıcı takip koduyla erişmeye devam eder).
  await prisma.order.updateMany({
    where: { customerEmail: email, customerId: null },
    data: { customerId: user.id },
  });

  await createSession(user.id);
  // token: native müşteri uygulaması Bearer ile oturum açsın (web çerezi de set).
  return NextResponse.json({ ok: true, token: signSession(user.id), name });
}
