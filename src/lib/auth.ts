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
  c.set(COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: "strict", // server action'lara CSRF yüzeyini kapatır
    secure: process.env.NODE_ENV === "production", // canlıda yalnız HTTPS
    path: "/",
    maxAge: TOKEN_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
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
    },
  });
  // Engellenen kullanıcının MEVCUT oturumu da geçersizdir (yalnız yeni giriş değil).
  if (!u || u.bannedAt) return null;
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
  const userId = readToken(auth.slice(7).trim());
  if (!userId) return null;
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
