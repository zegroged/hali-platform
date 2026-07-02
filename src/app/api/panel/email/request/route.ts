import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { syncVisibility } from "@/lib/panel";
import { mockNotifyAllowed } from "@/lib/config";
import { rateLimit, tooMany } from "@/lib/ratelimit";

const Body = z.object({ email: z.string().email().max(200) });

// Halıcının e-postasına 6 haneli doğrulama kodu gönderir (10 dk geçerli).
export async function POST(req: NextRequest) {
  const u = await getSessionUser();
  if (!u || u.role !== "CLEANER") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçerli bir e-posta girin" }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();

  // Flood/maliyet koruması: kullanıcı başına 60sn cooldown + saatte 3.
  const cd = rateLimit(`email-cooldown:${u.id}`, 1, 60 * 1000);
  if (!cd.ok) return tooMany(cd.retryAfterSec);
  const hr = rateLimit(`email-req:${u.id}`, 3, 60 * 60 * 1000);
  if (!hr.ok) return tooMany(hr.retryAfterSec);

  const code = String(crypto.randomInt(100000, 1000000));
  try {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        email,
        emailVerified: false, // yeni e-posta → yeniden doğrulanmalı
        emailOtpCode: code,
        emailOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
  } catch (e) {
    // e-posta benzersizlik çakışması → başka hesap kullanıyor
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Bu e-posta başka bir hesapta kullanılıyor." },
        { status: 409 },
      );
    }
    throw e;
  }

  // E-posta değişti → doğrulanana kadar işletmeyi listeden gizle (A2).
  const biz = await prisma.cleanerBusiness.findUnique({
    where: { ownerId: u.id },
    select: { id: true },
  });
  if (biz) await syncVisibility(biz.id);

  await sendVerificationEmail(email, code);

  // Kodu yanıtta yalnız geliştirmede VEYA soft-launch'ta (Brevo yokken test için) göster.
  const showCode = process.env.NODE_ENV !== "production" || mockNotifyAllowed;
  return NextResponse.json({ sent: true, devCode: showCode ? code : undefined });
}
