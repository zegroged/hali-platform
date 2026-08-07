import { cookies, headers } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionSecret } from "@/lib/config";
import type { UserRole } from "@prisma/client";

const COOKIE = "hali_session";

export async function hashPassword(p: string): Promise<string> {
  return bcrypt.hash(p, 10);
}
export async function verifyPassword(p: string, h: string): Promise<boolean> {
  return bcrypt.compare(p, h);
}

// Oturum ömrü — token'ın içine gömülür, süresi geçince geçersiz (cookie + Bearer).
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 gün

function sign(value: string): string {
  const mac = crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
  return `${value}.${mac}`;
}

function unsign(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const value = token.slice(0, i);
  const mac = token.slice(i + 1);
  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? value : null;
}

// Token gövdesi: `${userId}.${expiresAt}` — imzalanır, açılırken süre kontrol edilir.
function makeToken(userId: string): string {
  return sign(`${userId}.${Date.now() + TOKEN_TTL_MS}`);
}

/** Token ÜRETİM anı (userId'den sonraki damga − TTL). Şifre değişiminden
 *  önce üretilmiş token'ları elemek için kullanılır. */
function tokenUretimAni(token: string): number | null {
  const value = unsign(token);
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const expiresAt = Number(value.slice(dot + 1));
  if (!Number.isFinite(expiresAt)) return null;
  return expiresAt - TOKEN_TTL_MS;
}

function readToken(token: string): string | null {
  const value = unsign(token);
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null; // eski/biçimsiz token → reddet
  const userId = value.slice(0, dot);
  const expiresAt = Number(value.slice(dot + 1));
  if (!userId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return null;
  }
  return userId;
}

export async function createSession(userId: string): Promise<void> {
  const c = await cookies();
  // 🔴 DEMO BİLETİ HER YENİ OTURUMDA DÜŞER (2026-08-02 denetim, KRİTİK):
  // temizliği tek tek çağıran uçlara bırakmak delik bırakıyordu — /giris
  // temizleniyordu ama KAYIT (register / customer-register) temizlemiyordu.
  // Sonuç: komisyoncunun telefonundan hesap açan halıcı, /panel'de "Komisyoncu
  // paneline dön" şeridini görüp tek tıkla KOMİSYONCUNUN hesabına düşüyordu
  // (IBAN, kazanç, ekip). Artık oturum açan HER yol bileti siler; demoyaGec
  // bileti bu çağrıdan SONRA bırakır (sıra önemli).
  c.delete(DEMO_GERI_COOKIE);
  c.set(COOKIE, makeToken(userId), OTURUM_CEREZ_AYARI);
}

/**
 * 🔴 `sameSite` NEDEN "strict" DEĞİL "lax" (2026-08-07 akşam — işletme
 * sahibinin şikâyetinin ÖLÇÜLEN sebebi):
 *
 * *"İşletme sahipleri kendi paneline girerken sürekli kullanıcı adı şifre
 * girmek zorunda."* Oturum ömrü 30 gündü ve çerez kalıcıydı; sorun süre
 * DEĞİLDİ. `strict` çerez, **başka bir siteden gelen bağlantıda tarayıcı
 * tarafından GÖNDERİLMEZ.** Halıcı paneli genelde dışarıdan bir bağlantıyla
 * açılıyor: bizim bildirim e-postamızdaki `/panel/siparisler/...` linki,
 * WhatsApp'tan gönderilen adres, Google sonucu, kaydedilmiş bir mesaj…
 * Bu tıklamada çerez gitmediği için panel "oturum yok" deyip giriş ekranı
 * açıyordu. Kullanıcı şifre giriyor, çalışıyor — ta ki bir daha dışarıdan
 * bir bağlantıya tıklayana kadar. "Sürekli giriş" hissinin kaynağı buydu.
 *
 * `lax` çerezi ÜST DÜZEY GET gezinmelerinde (bağlantıya tıklama) gönderir,
 * ama çapraz siteden gelen POST / iframe / XHR isteklerinde GÖNDERMEZ —
 * yani server action'lara karşı CSRF koruması aynen durur. Next.js server
 * action'ları POST'tur; çapraz siteden gelen POST çereze erişemez.
 */
const OTURUM_CEREZ_AYARI = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production", // canlıda yalnız HTTPS
  path: "/",
  maxAge: TOKEN_TTL_MS / 1000,
};

/**
 * KAYAN OTURUM (2026-08-07 akşam): çerezi tazeler, BAŞKA HİÇBİR ŞEYE
 * DOKUNMAZ.
 *
 * ⚠️ Bilerek `createSession` çağırmıyoruz: o fonksiyon demo dönüş biletini
 * SİLİYOR (§7'deki kritik sıra kuralı). Panel her açılışta tazeleme yaparken
 * createSession çağırsaydı, demo panelindeki komisyoncunun "kendi hesabıma
 * dön" bileti sessizce yok olurdu.
 *
 * Aktif kullanan hiç çıkmaz; 30 gün boyunca HİÇ girmeyen çıkar (kayıp telefon
 * oturumu sonsuza kadar yaşamasın).
 */
export async function oturumCereziniTazele(userId: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, makeToken(userId), OTURUM_CEREZ_AYARI);
}

// DEMO GİRİŞİ DÖNÜŞ BİLETİ (2026-08-02) — komisyoncu dükkânda tek tıkla kendi
// demo işletmesine geçer, dönüşte şifre sormamak için mevcut oturum jetonu bu
// ayrı çerezde saklanır. Çerez adı ve jeton biçimi burada kapalı kalır.
//
// 🔴 Bilet, oturum jetonunun kendisidir: aynı imza, aynı süre kuralı. httpOnly
// + sameSite:strict + secure; 2 saatte düşer. Kime dönüleceğine biletin
// içindeki kimlik karar verir, ÇAĞIRAN DEĞİL — ve dönüşte rol yeniden okunur
// (bkz. demo-actions.ts: yalnız AGENT rolüne dönülür).
const DEMO_GERI_COOKIE = "hali_demo_geri";

/** Şu anki oturum jetonu (demo geçişinde SAKLANIP sonra bilete yazılır). */
export async function mevcutOturumJetonu(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE)?.value ?? null;
}

/** Verilen jetonu "dönüş bileti" olarak yaz (createSession'dan SONRA çağrılır). */
export async function demoBiletiYaz(jeton: string): Promise<void> {
  const c = await cookies();
  c.set(DEMO_GERI_COOKIE, jeton, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Ömür = oturum ömrü (denetim: 2 saatlik bilet dolunca komisyoncu demo
    // hesabında kilitli kalıyordu — kendi şifresini hatırlamıyorsa çıkamıyor).
    // Risk profili oturum çerezinin AYNISI; her yeni oturumda zaten siliniyor.
    maxAge: TOKEN_TTL_MS / 1000,
  });
}

/** Dönüş biletindeki kullanıcı kimliği (bileti HER durumda tüketir). */
export async function demoBiletiKullan(): Promise<string | null> {
  const c = await cookies();
  const bilet = c.get(DEMO_GERI_COOKIE)?.value;
  c.delete(DEMO_GERI_COOKIE);
  if (!bilet) return null;
  return readToken(bilet);
}

/** Bileti koşulsuz sil (girişte ve şifre değişiminde çağrılır). */
export async function demoBiletiTemizle(): Promise<void> {
  const c = await cookies();
  c.delete(DEMO_GERI_COOKIE);
}

/** Demo oturumundayız ve dönülecek bir komisyoncu oturumu var mı? */
export async function demoBiletiVarMi(): Promise<boolean> {
  const c = await cookies();
  return Boolean(c.get(DEMO_GERI_COOKIE)?.value);
}

export async function destroySession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
  // 🔴 DEMO BİLETİ DE SİLİNİR (2026-08-02 öz-denetim bulgusu): eskiden çıkışta
  // yalnız oturum çerezi gidiyordu; bilet kalınca ORTAK KULLANILAN telefonda
  // sonradan giren BAŞKA biri /panel'de "Komisyoncu paneline dön" şeridini
  // görüp tek tıkla KOMİSYONCUNUN hesabına düşebiliyordu. Bilet oturumun
  // ömrünü aşmamalı.
  c.delete(DEMO_GERI_COOKIE);
}

// username: giriş kimliği (telefon yerine). Eski hesaplarda null olabilir —
// panel/şoför layout'ları bu durumda "kullanıcı adı belirle" adımına yönlendirir.
export type SessionUser = {
  id: string;
  role: UserRole;
  name: string;
  username: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  const userId = readToken(token);
  if (!userId) return null;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      name: true,
      username: true,
      bannedAt: true,
      // 🔴 2026-08-07 DENETİMİ (madde 1, KRİTİK): bu alan burada YOKTU.
      sessionsValidFrom: true,
    },
  });
  // Engellenen kullanıcının MEVCUT oturumu da geçersizdir (yalnız yeni giriş değil).
  if (!u || u.bannedAt) return null;

  // 🔴 ŞİFRE DEĞİŞİNCE ÇEREZ DE ÖLMELİ (2026-08-07 denetimi, madde 1).
  //
  // AÇIK: `sessionsValidFrom` damgasını beş yol yazıyor (çalışan şifresi,
  // şoför şifresi, admin sıfırlaması ×2, "şifremi unuttum") ve `getBearerUser`
  // bu damgayı kontrol ediyordu — ama `getSessionUser` ETMİYORDU.
  // `getAuthedUser` önce çerezi denediği için Bearer dalındaki kontrol hiç
  // çalışmıyordu. Sonuç: hesabı ele geçiren biri açık oturumdayken kurban
  // şifresini değiştirse bile SALDIRGAN İÇERİDE KALIYORDU — üstelik panel
  // 12 saatte bir `/api/auth/yenile` çağırıp o çerezi 30 güne tazelediği için
  // süresiz. Kurbanın elindeki tek araç ("şifremi unuttum") işe yaramıyordu.
  //
  // Damgadan ÖNCE üretilmiş jeton reddedilir; kendi şifresini değiştiren
  // kullanıcı atılmasın diye o yolda yeni oturum açılır (sifre/actions.ts).
  if (u.sessionsValidFrom) {
    const uretim = tokenUretimAni(token);
    if (uretim == null || uretim < u.sessionsValidFrom.getTime()) return null;
  }
  return { id: u.id, role: u.role, name: u.name, username: u.username };
}

/** Belirli bir rol gerektirir; yoksa null döner (çağıran yönlendirir). */
export async function requireRole(
  role: UserRole,
): Promise<SessionUser | null> {
  const u = await getSessionUser();
  if (!u || u.role !== role) return null;
  return u;
}

// Native uygulama için imzalı, süreli token üretir (çerez yerine).
export function signSession(userId: string): string {
  return makeToken(userId);
}

// Authorization: Bearer <token> ile gelen native isteği çözer.
async function getBearerUser(): Promise<SessionUser | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const ham = auth.slice(7).trim();
  const userId = readToken(ham);
  if (!userId) return null;
  // Şifre değişiminden ÖNCE üretilmiş token geçersizdir (2026-07-28 denetim).
  const uretim = tokenUretimAni(ham);
  const damga = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionsValidFrom: true },
  });
  if (
    damga?.sessionsValidFrom &&
    uretim != null &&
    uretim < damga.sessionsValidFrom.getTime()
  ) {
    return null;
  }
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      name: true,
      username: true,
      bannedAt: true,
    },
  });
  if (!u || u.bannedAt) return null; // engelli: native token da geçersiz
  return { id: u.id, role: u.role, name: u.name, username: u.username };
}

// Çerez (web) VEYA Bearer token (native) — ikisini de kabul eder.
export async function getAuthedUser(): Promise<SessionUser | null> {
  return (await getSessionUser()) ?? (await getBearerUser());
}
