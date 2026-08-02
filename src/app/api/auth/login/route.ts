import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createSession,
  signSession,
  demoBiletiTemizle,
} from "@/lib/auth";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { looksLikeEmail, normalizeUsername } from "@/lib/username";

// GİRİŞ KİMLİĞİ: doğrulanmış e-posta VEYA kullanıcı adı. Telefon ARTIK KABUL
// EDİLMEZ — SMS doğrulaması olmadığından telefon sahipliği kanıtlanamıyordu.
const Body = z.object({
  // `identifier` yeni ad; `phone` eski native istemciler için geriye dönük
  // takma ad (alan adı eski, içeriği artık e-posta/kullanıcı adı).
  identifier: z.string().min(3).max(120).optional(),
  phone: z.string().min(3).max(120).optional(),
  password: z.string().min(1).max(72), // bcrypt 72 bayt sınırı
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
  }
  const raw = (parsed.data.identifier ?? parsed.data.phone ?? "").trim();
  const { password } = parsed.data;
  if (raw.length < 3) {
    return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
  }

  // E-posta ve kullanıcı adı aynı biçime indirgenir (küçük harf) — hem kayıtta
  // hem burada, böylece harf büyüklüğü girişi engellemez.
  const isEmail = looksLikeEmail(raw);
  const identifier = isEmail ? raw.toLowerCase() : normalizeUsername(raw);

  // Brute-force koruması: IP+kimlik başına 15 dakikada 5 deneme.
  const rl = rateLimit(`login:${ip}:${identifier}`, 5, 15 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const user = await prisma.user.findUnique({
    where: isEmail ? { email: identifier } : { username: identifier },
  });
  if (!user || !user.password) {
    return NextResponse.json({ error: "Geçersiz" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    return NextResponse.json({ error: "Geçersiz" }, { status: 401 });
  }
  // Doğrulanmamış e-postayla giriş yok: e-posta ancak doğrulanmışsa kimliktir.
  if (isEmail && !user.emailVerified) {
    return NextResponse.json(
      { error: "E-postanız doğrulanmamış. Kullanıcı adınızla girin." },
      { status: 403 },
    );
  }
  // Admin engeli: şifre doğru olsa da giriş yok.
  if (user.bannedAt) {
    return NextResponse.json(
      { error: "Hesabınız kısıtlandı. Bizimle iletişime geçin." },
      { status: 403 },
    );
  }
  // Taze giriş: varsa eski demo dönüş bileti düşer (ortak telefonda başkasının
  // oturumuna sıçrama riski — bkz. auth.ts destroySession notu).
  await demoBiletiTemizle();
  await createSession(user.id);
  // token: native şoför uygulaması için (web çerezi de ayrıca set edildi)
  return NextResponse.json({
    role: user.role,
    name: user.name,
    // Kullanıcı adı yoksa istemci "belirle" adımına yönlendirir.
    needsUsername: user.username == null,
    token: signSession(user.id),
  });
}
