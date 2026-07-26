import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendSms } from "@/lib/sms";
import { waOtp, whatsappEnabled } from "@/lib/whatsapp";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// Telefon doğrulama kodu gönder. 6 haneli (CSPRNG), 10 dk geçerli.
export async function POST(_req: NextRequest) {
  const u = await getSessionUser();
  if (!u || u.role !== "CLEANER") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  // SMS maliyeti/flood koruması: kullanıcı başına saatte 3 kod + 60sn cooldown.
  const cd = rateLimit(`otp-cooldown:${u.id}`, 1, 60 * 1000);
  if (!cd.ok) return tooMany(cd.retryAfterSec);
  const hr = rateLimit(`otp-req:${u.id}`, 3, 60 * 60 * 1000);
  if (!hr.ok) return tooMany(hr.retryAfterSec);

  const code = String(crypto.randomInt(100000, 1000000)); // 100000–999999
  await prisma.user.update({
    where: { id: u.id },
    data: { otpCode: code, otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  const user = await prisma.user.findUnique({
    where: { id: u.id },
    select: { phone: true },
  });
  // KANAL SIRASI (2026-07-26): önce WhatsApp (mesaj başına ~25 kuruş, okunma
  // oranı yüksek), gitmezse SMS'e düş. SMS hâlâ mock olduğundan WhatsApp
  // açılana kadar davranış değişmez.
  let kanal = "sms";
  if (whatsappEnabled) {
    const r = await waOtp(user!.phone, code);
    if (r.ok) kanal = "whatsapp";
  }
  if (kanal === "sms") {
    await sendSms(user!.phone, `En Yakin Hali Yikama dogrulama kodunuz: ${code}`);
  }

  // Kodu YANITTA yalnız geliştirmede göster (üretimde asla sızdırma).
  const dev = process.env.NODE_ENV !== "production";
  return NextResponse.json({ sent: true, devCode: dev ? code : undefined });
}
