import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { emailLive } from "@/lib/config";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { isDisposableEmail } from "@/lib/emailGuard";

const Body = z.object({ email: z.string().trim().email().max(120) });

// İşletme kaydı ÖNCESİ e-posta doğrulama kodu: hesap ancak koda sahip olan
// (yani posta kutusuna gerçekten erişen) kişi tarafından açılabilir.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçerli bir e-posta adresi girin." },
      { status: 400 },
    );
  }
  const email = parsed.data.email.toLowerCase();

  // Çöp/tek kullanımlık e-posta servisleri kabul edilmez (sahte kayıt caydırma).
  if (isDisposableEmail(email)) {
    return NextResponse.json(
      { error: "Lütfen kalıcı bir e-posta adresi kullanın." },
      { status: 400 },
    );
  }

  // Zaten kayıtlı e-posta → kod göndermeye gerek yok, girişe yönlendir.
  const exists = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  if (exists) {
    return NextResponse.json(
      { error: "Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin." },
      { status: 409 },
    );
  }

  // Flood/maliyet koruması: e-posta başına 60 sn cooldown + saatte 3;
  // IP başına saatte 6 (farklı adreslerle bombalamayı da sınırlar).
  const ip = clientIp(req);
  const cd = rateLimit(`signup-otp-cd:${email}`, 1, 60 * 1000);
  if (!cd.ok) return tooMany(cd.retryAfterSec);
  const hr = rateLimit(`signup-otp:${email}`, 3, 60 * 60 * 1000);
  if (!hr.ok) return tooMany(hr.retryAfterSec);
  const ipRl = rateLimit(`signup-otp-ip:${ip}`, 6, 60 * 60 * 1000);
  if (!ipRl.ok) return tooMany(ipRl.retryAfterSec);

  const code = String(crypto.randomInt(100000, 1000000));
  await prisma.signupOtp.upsert({
    where: { email },
    create: {
      email,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
    update: {
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
    },
  });

  await sendVerificationEmail(email, code);

  // Panel OTP'siyle aynı soft-launch deseni: SMTP canlı değilken kod yanıtta
  // döner ve ekranda gösterilir; EMAIL_MODE=live olunca otomatik gizlenir.
  // Kod yalnız e-posta gerçekten GÖNDERİLEMİYORKEN ekranda gösterilir.
  const showCode = process.env.NODE_ENV !== "production" || !emailLive;
  return NextResponse.json({ sent: true, devCode: showCode ? code : undefined });
}
