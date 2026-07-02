import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { syncVisibility } from "@/lib/panel";
import { rateLimit, tooMany } from "@/lib/ratelimit";

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
  // Brute-force koruması: 15 dakikada 5 deneme.
  const rl = rateLimit(`email-confirm:${u.id}`, 5, 15 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { code } = await req.json().catch(() => ({}));
  const codeStr = String(code ?? "");
  const user = await prisma.user.findUnique({
    where: { id: u.id },
    select: { emailOtpCode: true, emailOtpExpiresAt: true },
  });
  if (
    !user?.emailOtpCode ||
    !user.emailOtpExpiresAt ||
    user.emailOtpExpiresAt < new Date() ||
    !timingSafeEqual(codeStr, user.emailOtpCode)
  ) {
    return NextResponse.json(
      { ok: false, error: "Kod hatalı veya süresi dolmuş" },
      { status: 400 },
    );
  }
  await prisma.user.update({
    where: { id: u.id },
    data: { emailVerified: true, emailOtpCode: null, emailOtpExpiresAt: null },
  });
  // E-posta doğrulandı → VERIFIED + profil tamsa işletme tekrar görünür olur.
  const biz = await prisma.cleanerBusiness.findUnique({
    where: { ownerId: u.id },
    select: { id: true },
  });
  if (biz) await syncVisibility(biz.id);
  return NextResponse.json({ ok: true });
}
