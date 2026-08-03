import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { getAppBaseUrl } from "@/lib/config";
import { roleHome } from "@/lib/roleHome";

// MOBİL → PANEL DEVRİ (2026-08-04, kullanıcı kararı: "işletmeler ve
// komisyoncular da uygulamadan girsin, aynı ekrandan, sitede olduğu gibi").
//
// SORUN: uygulama tek giriş ekranı kullanıyor ve `/api/auth/login`'den bir
// JETON alıyor (Bearer). Şoför ekranları bu jetonla çalışıyor. Ama işletme ve
// komisyoncu için uygulamanın içinde PANELİN KENDİSİ açılıyor; panel ise
// tarayıcı ÇEREZİYLE (`hali_session`) kimlik doğruluyor. Jeton, WebView'in
// çerez kavanozunda değil.
//
// ÇÖZÜM: TEK KULLANIMLIK, KISA ÖMÜRLÜ BAĞLANTI.
//   1) Uygulama bu uca Bearer jetonuyla gelir.
//   2) Uç bir nonce üretir, 90 saniyelik ve TEK KULLANIMLIK olarak saklar.
//   3) Uygulama WebView'i `/m/<nonce>` adresine götürür; orada çerez kurulur
//      ve rolün açılış sayfasına yönlendirilir.
//
// 🔴 NEDEN JETONU DOĞRUDAN URL'E KOYMUYORUZ: oturum jetonu adres çubuğuna,
// sunucu erişim log'una, Cloudflare kayıtlarına ve Referer başlığına düşerdi —
// yani kalıcı bir kimlik sızıntısı. Nonce ise 90 saniyede ölür, bir kez
// kullanılır ve kendisiyle başka hiçbir şey yapılamaz.
//
// Yeni bir YETKİ yüzeyi açmıyor: nonce'u ancak ZATEN geçerli bir oturumu olan
// biri alabiliyor; verdiği şey de aynı kullanıcının oturumundan fazlası değil.

export const dynamic = "force-dynamic";

/** Bağlantı ömrü — kullanıcı uygulamada giriş yapar yapmaz tüketilir. */
const OMUR_MS = 90 * 1000;

export async function POST() {
  const u = await getAuthedUser();
  if (!u) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  // Bozuk bir istemci döngüsü AppState'i şişirmesin.
  const rl = rateLimit(`mobil-baglanti:${u.id}`, 20, 10 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const nonce = crypto.randomBytes(24).toString("base64url");
  await prisma.appState.create({
    data: {
      key: `m-${nonce}`,
      value: JSON.stringify({ userId: u.id, until: Date.now() + OMUR_MS }),
    },
  });

  const home = roleHome(u.role);
  return NextResponse.json({
    url: `${getAppBaseUrl()}/m/${nonce}`,
    role: u.role,
    home,
  });
}
