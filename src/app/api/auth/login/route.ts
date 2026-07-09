import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession, signSession } from "@/lib/auth";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

const Body = z.object({
  // Telefon (05xxxxxxxxx) VEYA kullanıcı adı (admin/destek hesapları) — native
  // uygulamalar da aynı "phone" alanını gönderdiğinden alan adı korunuyor.
  phone: z.string().min(3).max(50),
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

  // Ayraçlar (boşluk/tire/parantez/nokta) söküldüğünde salt rakam kalıyorsa
  // telefon, kalmıyorsa kullanıcı adı olarak ara (ikisi de @unique).
  const digits = phone.replace(/[\s().-]/g, "");
  const user = await prisma.user.findUnique({
    where: /^\d+$/.test(digits) && digits.length > 0
      ? { phone: digits }
      : { username: phone.trim() },
  });
  if (!user || !user.password) {
    return NextResponse.json({ error: "Geçersiz" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    return NextResponse.json({ error: "Geçersiz" }, { status: 401 });
  }
  // Admin engeli: şifre doğru olsa da giriş yok.
  if (user.bannedAt) {
    return NextResponse.json(
      { error: "Hesabınız kısıtlandı. Bizimle iletişime geçin." },
      { status: 403 },
    );
  }
  await createSession(user.id);
  // token: native şoför uygulaması için (web çerezi de ayrıca set edildi)
  return NextResponse.json({
    role: user.role,
    name: user.name,
    token: signSession(user.id),
  });
}
