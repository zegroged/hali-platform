import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

// Ücretsiz geocoding — OpenStreetMap Nominatim. Adres/semt -> koordinat.
export async function GET(req: NextRequest) {
  // Nominatim kullanım politikası (≈1 istek/sn) — IP başına sınırla, aksi halde
  // sunucu IP'si yasaklanabilir; ayrıca dışa-yönelik abuse'i bound'la.
  const rl = rateLimit(`geocode:${clientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

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
        "User-Agent": "HaliYikamaPlatformu/1.0 (dev)",
        "Accept-Language": "tr",
      },
      cache: "no-store",
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
