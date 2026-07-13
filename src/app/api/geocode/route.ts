import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

// Nominatim genel kullanım politikası: sunucu genelinde ≈1 istek/sn. Tek IP'nin
// sınırlanması yetmez (denetim bulgusu) — TÜM istekler tek sunucu IP'sinden
// gider; global bir kapı da koy ki Nominatim bizi banlamasın.
let lastNominatimAt = 0;

// Ücretsiz geocoding — OpenStreetMap Nominatim. Adres/semt -> koordinat.
export async function GET(req: NextRequest) {
  // (1) IP başına: 30/dk.
  const rl = rateLimit(`geocode:${clientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
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
      return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    }
    const r = data[0];
    return NextResponse.json({
      lat: Number(r.lat),
      lng: Number(r.lon),
      label: r.display_name,
    });
  } catch {
    return NextResponse.json({ error: "Geocode hatası" }, { status: 502 });
  }
}
