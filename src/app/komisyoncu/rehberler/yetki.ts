import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Rehber sayfalarının ORTAK yetki kapısı (2026-08-02).
//
// Her rota (liste, okuma, indirme) bunu prisma'dan / içerik üretiminden ÖNCE
// çağırır. Layout'a güvenilmez — App Router'da veri çeken korumalı sayfa
// kendi kontrolünü kendisi yapmalı (bkz. app-router-auth-leak dersi).
//
// `isHead` yalnız BAŞ KOMİSYONCU rehberinin kapısıdır; havuz matematiğinin
// alt kademeye sızmaması buna bağlıdır.
export async function komisyoncuKimligi(): Promise<{ isHead: boolean } | null> {
  const u = await getSessionUser();
  if (!u || u.role !== "AGENT") return null;
  const agent = await prisma.agent.findUnique({
    where: { userId: u.id },
    select: { isHead: true },
  });
  return agent ? { isHead: agent.isHead } : null;
}
