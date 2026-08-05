import { NextResponse } from "next/server";
import { getAuthedUser, signSession } from "@/lib/auth";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// OTURUM YENİLEME (2026-08-06, kullanıcı: "bir kere girdiğinde çıkış yapıncaya
// kadar bir daha girmesin").
//
// SORUN: mobil jetonun ömrü 30 gün ve YENİLENMİYORDU. Uygulamayı her gün
// kullanan şoför 30. günde, hiçbir şey yapmadığı hâlde giriş ekranına düşüyordu.
//
// ÇÖZÜM: uygulama her açılışta bu ucu çağırır, taze jeton alır. Aktif kullanan
// kullanıcı fiilen hiç çıkmaz; 30 gün boyunca uygulamayı HİÇ açmayan çıkar —
// ki bu doğru davranıştır (kayıp/çalıntı telefonun oturumu sonsuza kadar
// yaşamasın).
//
// GÜVENLİK: yeni jeton ancak GEÇERLİ bir jetonla alınabilir. Süresi dolmuş,
// şifre değişimiyle geçersizleşmiş (sessionsValidFrom) ya da engellenmiş
// kullanıcının jetonu `getAuthedUser` tarafından zaten reddedilir — yani bu uç
// ölü bir oturumu diriltemez.

export const dynamic = "force-dynamic";

export async function POST() {
  const u = await getAuthedUser();
  if (!u) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  // Bozuk bir istemci döngüsü jeton üretim makinesine dönüşmesin.
  const rl = rateLimit(`oturum-yenile:${u.id}`, 60, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  return NextResponse.json({
    token: signSession(u.id),
    role: u.role,
    name: u.name,
  });
}
