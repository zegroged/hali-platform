import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/config";
import { roleHome } from "@/lib/roleHome";

// MOBİL DEVİR — BAĞLANTIYI TÜKET, ÇEREZİ KUR, ROLÜN SAYFASINA GÖNDER.
// Karşılığı: /api/auth/mobil-baglanti (gerekçesi orada yazılı).
//
// 🔴 TEK KULLANIMLIK: kaydı `delete` ile alıyoruz — silme işleminin kendisi
// "bileti kaptım" demektir. İki istek yarışırsa yalnız biri silmeyi başarır,
// öteki P2025 alır ve reddedilir. `findUnique` + sonra `delete` deseni bu
// garantiyi vermezdi (aynı nonce iki kez kullanılabilirdi).

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nonce: string }> },
) {
  const { nonce } = await params;
  const taban = getAppBaseUrl();
  const hata = (m: string) =>
    NextResponse.redirect(`${taban}/giris?hata=${encodeURIComponent(m)}`, 303);

  if (!nonce || nonce.length > 100) return hata("Bağlantı geçersiz.");

  let kayit: { value: string } | null = null;
  try {
    kayit = await prisma.appState.delete({
      where: { key: `m-${nonce}` },
      select: { value: true },
    });
  } catch {
    // Kayıt yok: ya süresi doldu, ya zaten kullanıldı, ya da uydurma.
    return hata("Bağlantının süresi dolmuş. Uygulamadan tekrar giriş yap.");
  }

  let veri: { userId?: string; until?: number };
  try {
    veri = JSON.parse(kayit.value);
  } catch {
    return hata("Bağlantı okunamadı.");
  }
  if (!veri.userId || !veri.until || Date.now() > veri.until)
    return hata("Bağlantının süresi dolmuş. Uygulamadan tekrar giriş yap.");

  // Kullanıcı hâlâ geçerli mi (silinmiş/engellenmiş olabilir).
  const u = await prisma.user.findUnique({
    where: { id: veri.userId },
    select: { id: true, role: true, bannedAt: true },
  });
  if (!u || u.bannedAt) return hata("Hesap kullanılamıyor.");

  // Çerezi kur (aynı fonksiyon web girişinde de kullanılıyor: demo bileti
  // temizliği ve jeton biçimi tek yerde kalsın).
  await createSession(u.id);
  return NextResponse.redirect(`${taban}${roleHome(u.role)}`, 303);
}
