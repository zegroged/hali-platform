import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

// Nominatim genel kullanım politikası: sunucu genelinde ≈1 istek/sn. Tek IP'nin
// sınırlanması yetmez (denetim bulgusu) — TÜM istekler tek sunucu IP'sinden
// gider; global bir kapı da koy ki Nominatim bizi banlamasın.
let lastNominatimAt = 0;

// ÖNBELLEK (2026-08-06) — ölçek hazırlığı.
//
// NEDEN: adresler TEKRAR EDER (aynı mahalle, aynı sokak, aynı ilçe). Her
// istek Nominatim'e taze gidiyordu (`cache: "no-store"`) ve Nominatim'in
// kamu sunucusu ağır kullanımı YASAKLIYOR (~1 istek/sn). Yukarıdaki global
// kapı bizi banlanmaktan koruyor ama aynı zamanda KULLANICIYI 429'la geri
// çeviriyor: iki müşteri aynı saniyede adres yazarsa biri hata alıyor.
// Önbellek ikisini de çözer — tekrar eden adres Nominatim'e HİÇ gitmez.
//
// Bellek içi ve tek instance için yeterli (rate-limiter da öyle). Çok
// instance'a geçilirse Redis/DB'ye taşınmalı. Kendi Nominatim'imiz kurulunca
// (bkz. DEVIR §5-D0) bu önbellek yine işe yarar: gecikmeyi düşürür.
const ONBELLEK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // adres koordinatı haftalarca değişmez
const ONBELLEK_MAX = 5000; // kaba tavan; taşarsa en eskiler atılır
type GeoKayit = { govde: unknown; durum: number; zaman: number };
const onbellek = new Map<string, GeoKayit>();

/** Sorguyu normalize et: büyük/küçük ve fazla boşluk aynı kayda düşsün. */
function onbellekAnahtari(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function onbellektenAl(anahtar: string): GeoKayit | null {
  const k = onbellek.get(anahtar);
  if (!k) return null;
  if (Date.now() - k.zaman > ONBELLEK_TTL_MS) {
    onbellek.delete(anahtar);
    return null;
  }
  // LRU'ya yaklaşım: erişilen kaydı sona taşı (Map ekleme sırasını korur).
  onbellek.delete(anahtar);
  onbellek.set(anahtar, k);
  return k;
}

function onbellegeYaz(anahtar: string, govde: unknown, durum: number): void {
  if (onbellek.size >= ONBELLEK_MAX) {
    // En eski kaydı at (Map'in ilk anahtarı).
    const ilk = onbellek.keys().next().value;
    if (ilk !== undefined) onbellek.delete(ilk);
  }
  onbellek.set(anahtar, { govde, durum, zaman: Date.now() });
}

// Ücretsiz geocoding — OpenStreetMap Nominatim. Adres/semt -> koordinat.
export async function GET(req: NextRequest) {
  // (1) IP başına: 30/dk.
  const rl = rateLimit(`geocode:${clientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  // ÖNBELLEK KONTROLÜ hız sınırından ÖNCE: önbellekten dönen cevap Nominatim'e
  // hiç gitmiyor, dolayısıyla 1 sn'lik global kapıyı harcamamalı. Sıra
  // değiştirilirse tekrar eden adresler boşuna 429 yer.
  const qHam = req.nextUrl.searchParams.get("q");
  if (qHam && qHam.trim().length >= 2 && qHam.length <= 200) {
    const vurus = onbellektenAl(onbellekAnahtari(qHam));
    if (vurus) {
      return NextResponse.json(vurus.govde as object, { status: vurus.durum });
    }
  }
  // (2) Global (sunucu geneli): son çağrıdan 1 sn geçmediyse reddet.
  const now = Date.now();
  if (now - lastNominatimAt < 1000) {
    return NextResponse.json(
      { error: "Çok hızlı, biraz sonra tekrar dene." },
      { status: 429, headers: { "retry-after": "1" } },
    );
  }
  lastNominatimAt = now;

  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2 || q.length > 200) {
    return NextResponse.json({ error: "Eksik veya geçersiz sorgu" }, { status: 400 });
  }
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=" +
      encodeURIComponent(q);
    const res = await fetch(url, {
      headers: {
        // Nominatim politikası: gerçek iletişim bilgisi içeren UA ister.
        "User-Agent":
          "EnYakinHaliYikama/1.0 (+https://enyakinhaliyikamaservisi.com; destek@enyakinhaliyikamaservisim.com)",
        "Accept-Language": "tr",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000), // takılırsa akışı bloklama (register ile aynı)
    });
    if (!res.ok) throw new Error("geocode failed");
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!data.length) {
      // "Bulunamadı" da önbelleğe girer: aynı hatalı adresi 10 kez yazan
      // kullanıcı Nominatim'i 10 kez yormasın.
      const bos = { error: "Bulunamadı" };
      onbellegeYaz(onbellekAnahtari(q), bos, 404);
      return NextResponse.json(bos, { status: 404 });
    }
    const r = data[0];
    const govde = {
      lat: Number(r.lat),
      lng: Number(r.lon),
      label: r.display_name,
    };
    onbellegeYaz(onbellekAnahtari(q), govde, 200);
    return NextResponse.json(govde);
  } catch {
    return NextResponse.json({ error: "Geocode hatası" }, { status: 502 });
  }
}
