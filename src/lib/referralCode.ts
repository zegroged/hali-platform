import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

// TEK KULLANIMLIK komisyoncu referans kodları (kullanıcı kararı 2026-07-23):
// kalıcı kod YOK — komisyoncu her müşteri için panelinden yeni kod üretir,
// kod bir işletmeye bağlanınca YANAR. Yarışa dayanıklı tüketim: koşullu
// updateMany (usedAt IS NULL) — aynı kodu iki kayıt aynı anda kullanamaz.

// Karışan karakterler yok (0/O, 1/I): telefonla okunurken hata azalır.
const HARFLER = "ABCDEFGHJKLMNPRSTUVYZ23456789";

export function uretKodMetni(): string {
  let k = "";
  for (let i = 0; i < 6; i++) k += HARFLER[crypto.randomInt(HARFLER.length)];
  return `HYK-${k}`;
}

/** Kod ön-kontrolü (dostane hata için): geçerli + kullanılmamış + aktif
 *  komisyoncuya ait mi? Yarış güvencesi DEĞİLDİR — tüketim claim ile yapılır. */
export async function findUsableCode(code: string) {
  const row = await prisma.agentReferralCode.findUnique({
    where: { code },
    include: { agent: { select: { id: true, active: true } } },
  });
  if (!row || row.usedAt || !row.agent.active) return null;
  return { codeId: row.id, agentId: row.agent.id };
}

/** Kodu ATOMİK tüket (işletme OLUŞMADAN önce çağrılır — yarışı kaybeden
 *  kayıt akışı anlaşılır hatayla durur). true = kod bizim. */
export async function claimCode(codeId: string): Promise<boolean> {
  const r = await prisma.agentReferralCode.updateMany({
    where: { id: codeId, usedAt: null },
    data: { usedAt: new Date() },
  });
  return r.count === 1;
}

/** Tüketilen kodu oluşturulan işletmeye iliştir (raporlamada "hangi kod
 *  hangi işletmeye" görünür). Best-effort. */
export async function attachCodeToBusiness(
  codeId: string,
  businessId: string,
): Promise<void> {
  await prisma.agentReferralCode
    .update({ where: { id: codeId }, data: { usedByBusinessId: businessId } })
    .catch(() => {});
}
