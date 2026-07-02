import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession, signSession } from "@/lib/auth";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

const Body = z.object({
  phone: z.string().min(10).max(20),
  password: z.string().min(1).max(72), // bcrypt 72 bayt sınırı
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
  }
  const { phone, password } = parsed.data;

  // Brute-force koruması: IP+telefon başına 15 dakikada 5 deneme.
  const rl = rateLimit(`login:${ip}:${phone}`, 5, 15 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.password) {
    return NextResponse.json({ error: "Geçersiz" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    return NextResponse.json({ error: "Geçersiz" }, { status: 401 });
  }
  await createSession(user.id);
  // token: native şoför uygulaması için (web çerezi de ayrıca set edildi)
  return NextResponse.json({
    role: user.role,
    name: user.name,
    token: signSession(user.id),
  });
}
