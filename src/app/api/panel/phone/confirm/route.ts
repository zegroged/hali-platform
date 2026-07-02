import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// Sabit-zamanlı string karşılaştırma (kod sızıntısına karşı).
function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(req: NextRequest) {
  const u = await getSessionUser();
  if (!u || u.role !== "CLEANER") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  // Brute-force koruması: kullanıcı başına 15 dakikada 5 deneme.
  const rl = rateLimit(`otp-confirm:${u.id}`, 5, 15 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { code } = await req.json().catch(() => ({}));
  const codeStr = String(code ?? "");
  const user = await prisma.user.findUnique({
    where: { id: u.id },
    select: { otpCode: true, otpExpiresAt: true },
  });
  if (
    !user?.otpCode ||
    !user.otpExpiresAt ||
    user.otpExpiresAt < new Date() ||
    !timingSafeEqual(codeStr, user.otpCode)
  ) {
    return NextResponse.json(
      { ok: false, error: "Kod hatalı veya süresi dolmuş" },
      { status: 400 },
    );
  }
  await prisma.user.update({
    where: { id: u.id },
    data: { phoneVerified: true, otpCode: null, otpExpiresAt: null },
  });
  return NextResponse.json({ ok: true });
}
