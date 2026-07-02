import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { CONTRACT_VERSION } from "@/lib/legal";

// İşletme self-servis kaydı. Hesap PENDING açılır ve görünmez;
// panel akışı (e-posta doğrulama → profil → admin onayı) tamamlar.
const Body = z.object({
  businessName: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(60),
  phone: z.string().regex(/^05\d{9}$/, "Telefon 05xx ile 11 hane olmalı"),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72), // bcrypt 72 bayt sınırı
  city: z.string().trim().min(2).max(40),
  district: z.string().trim().min(2).max(40),
  // Aracılık sözleşmesi teyidi (işaretlenmemiş zorunlu checkbox) — onaysız
  // kayıt kurulmaz (ETAHS Yönetmeliği: elektronik aracılık sözleşmesi şartı).
  consent: z.literal(true),
  // Kayıt öncesi e-postaya gönderilen 6 haneli doğrulama kodu.
  emailCode: z.string().trim().length(6),
  // Honeypot: gerçek kullanıcı bu gizli alanı görmez/doldurmaz; botlar doldurur.
  website: z.string().max(200).optional(),
});

// Kayıtta profil boş açılır; halıcı panelden düzenler (seed ile aynı varsayılan).
const DEFAULT_WORKING_HOURS = {
  mon: { open: "09:00", close: "19:00" },
  tue: { open: "09:00", close: "19:00" },
  wed: { open: "09:00", close: "19:00" },
  thu: { open: "09:00", close: "19:00" },
  fri: { open: "09:00", close: "19:00" },
  sat: { open: "10:00", close: "17:00" },
  sun: null,
};

// İlçe merkezini koordinata çevir — keşif "mesafe" sıralaması için gerekli.
// Nominatim erişilemezse İstanbul merkeziyle açılır; panelden adres
// güncellenince düzelir.
async function geocodeDistrict(
  district: string,
  city: string,
): Promise<{ lat: number; lng: number }> {
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=" +
      encodeURIComponent(`${district}, ${city}`);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "HaliYikamaPlatformu/1.0",
        "Accept-Language": "tr",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data.length) {
        return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
      }
    }
  } catch {
    // sessiz düş — varsayılan koordinat
  }
  return { lat: 41.0082, lng: 28.9784 };
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // Kötüye kullanım koruması: IP başına saatte 3 kayıt denemesi.
  const rl = rateLimit(`register:${ip}`, 3, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Eksik veya hatalı bilgi. Alanları kontrol edin." },
      { status: 400 },
    );
  }
  const { businessName, name, phone, password, city, district, emailCode } =
    parsed.data;
  const email = parsed.data.email.toLowerCase();

  // Honeypot dolu = bot → ayrıntı vermeden reddet.
  if (parsed.data.website) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  // E-posta doğrulama kodu (kayıt ancak posta kutusuna erişenle kurulur).
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
    return NextResponse.json(
      { error: "Doğrulama kodu hatalı." },
      { status: 400 },
    );
  }
  await prisma.signupOtp.delete({ where: { email } });

  const existing = await prisma.user.findFirst({
    where: { OR: [{ phone }, { email }] },
    select: { phone: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          existing.phone === phone
            ? "Bu telefon numarasıyla zaten bir hesap var. Giriş yapmayı deneyin."
            : "Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.",
      },
      { status: 409 },
    );
  }

  const [{ lat, lng }, hashed] = await Promise.all([
    geocodeDistrict(district, city),
    hashPassword(password),
  ]);

  const owner = await prisma.user.create({
    data: {
      role: "CLEANER",
      name,
      phone,
      email,
      emailVerified: true, // kayıt öncesi kodla doğrulandı
      password: hashed,
      // e-posta panel akışında doğrulanır (emailVerified=false başlar)
      ownedBusiness: {
        create: {
          name: businessName,
          address: `${district}, ${city}`,
          city,
          district,
          lat,
          lng,
          phone,
          workingHours: DEFAULT_WORKING_HOURS,
          verification: "PENDING",
          isVisible: false,
          // Sözleşme kayıtta checkbox ile onaylandı — panel adımı otomatik tamam.
          contractAcceptedAt: new Date(),
          contractVersion: CONTRACT_VERSION,
          serviceAreas: { create: [{ city, district }] },
        },
      },
    },
  });

  await createSession(owner.id);
  return NextResponse.json({ ok: true });
}
