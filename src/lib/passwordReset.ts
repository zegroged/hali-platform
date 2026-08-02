import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, wrapEmail } from "@/lib/email";

// ŞİFREMİ UNUTTUM (2026-08-02, kullanıcı isteği). Önceden hiçbir rolde
// self-servis sıfırlama yoktu: şifresini unutan komisyoncu/halıcı/şoför
// yöneticiyi arayıp SQL'e kadar giden bir zincire muhtaçtı.
//
// 🔴 TASARIM KURALLARI:
//  - Jetonun kendisi DB'de DURMAZ; yalnız sha256 özeti saklanır.
//  - Bilet 1 saat geçerli, TEK kullanımlık; kullanılınca damgalanır.
//  - Yeni bilet üretilince o kullanıcının önceki biletleri geçersizleşir.
//  - HESAP İFŞASI YOK: e-posta kayıtlı olsun olmasın ekran aynı cevabı verir.
//  - Şifre değişince `sessionsValidFrom` yenilenir (mobil jetonlar düşer).

const BILET_OMRU_MS = 60 * 60 * 1000; // 1 saat

function ozet(jeton: string): string {
  return crypto.createHash("sha256").update(jeton).digest("hex");
}

function siteKoku(): string {
  return (
    process.env.APP_BASE_URL ?? "https://enyakinhaliyikamaservisi.com"
  ).replace(/\/$/, "");
}

/**
 * Kimlik (e-posta VEYA kullanıcı adı) için sıfırlama bileti üretip e-posta yollar.
 * Dönen değer akışı DEĞİŞTİRMEZ — çağıran her durumda aynı mesajı gösterir.
 */
export async function sifreBiletiGonder(kimlik: string): Promise<void> {
  const temiz = kimlik.trim().toLowerCase();
  if (!temiz) return;
  const user = await prisma.user.findFirst({
    where: temiz.includes("@") ? { email: temiz } : { username: temiz },
    select: { id: true, email: true, name: true, bannedAt: true },
  });
  // E-postası olmayan hesaba (ör. e-posta eklememiş komisyoncu) bilet gitmez —
  // ekranda yine aynı cevap görünür, kullanıcı yöneticiyi arar.
  if (!user || !user.email || user.bannedAt) return;

  const jeton = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // Eski biletleri yak: aynı anda tek geçerli bilet olsun.
    prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: ozet(jeton),
        expiresAt: new Date(Date.now() + BILET_OMRU_MS),
      },
    }),
  ]);

  const link = `${siteKoku()}/sifre-sifirla?jeton=${encodeURIComponent(jeton)}`;
  await sendEmail(
    user.email,
    "Şifre sıfırlama — En Yakın Halı Yıkama",
    `Merhaba ${user.name},\n\nŞifreni sıfırlamak için bu bağlantıya tıkla (1 saat geçerli):\n${link}\n\nBu isteği sen yapmadıysan bu e-postayı yok say; şifren değişmez.`,
    wrapEmail(`
      <p>Merhaba <strong>${user.name}</strong>,</p>
      <p>Şifreni sıfırlamak için aşağıdaki düğmeye bas. Bağlantı <strong>1 saat</strong> geçerlidir ve yalnız bir kez kullanılabilir.</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Şifremi sıfırla</a>
      </p>
      <p style="font-size:13px;color:#64748b">Düğme çalışmazsa bu adresi tarayıcına yapıştır:<br>${link}</p>
      <p style="font-size:13px;color:#64748b">Bu isteği sen yapmadıysan bu e-postayı yok say — şifren değişmez.</p>
    `),
  );
}

export type BiletSonuc =
  | { ok: true; userId: string }
  | { ok: false; hata: string };

/** Bileti doğrula (tüketmeden) — sıfırlama formunu göstermeden önce. */
export async function bileteBak(jeton: string): Promise<BiletSonuc> {
  if (!jeton) return { ok: false, hata: "Bağlantı eksik." };
  const kayit = await prisma.passwordReset.findUnique({
    where: { tokenHash: ozet(jeton) },
    select: { userId: true, usedAt: true, expiresAt: true },
  });
  if (!kayit || kayit.usedAt)
    return { ok: false, hata: "Bu bağlantı kullanılmış ya da geçersiz." };
  if (kayit.expiresAt.getTime() < Date.now())
    return { ok: false, hata: "Bağlantının süresi dolmuş (1 saat)." };
  return { ok: true, userId: kayit.userId };
}

/**
 * Bileti TÜKET ve şifreyi yaz. Tüketim koşullu updateMany ile yapılır:
 * iki sekme aynı anda gönderse bile ikincisi boşa düşer (CAS).
 */
export async function biletiKullan(
  jeton: string,
  yeniHash: string,
): Promise<BiletSonuc> {
  const bak = await bileteBak(jeton);
  if (!bak.ok) return bak;
  const tuket = await prisma.passwordReset.updateMany({
    where: { tokenHash: ozet(jeton), usedAt: null },
    data: { usedAt: new Date() },
  });
  if (tuket.count !== 1)
    return { ok: false, hata: "Bu bağlantı az önce kullanıldı." };
  await prisma.user.update({
    where: { id: bak.userId },
    data: { password: yeniHash, sessionsValidFrom: new Date() },
  });
  return bak;
}
