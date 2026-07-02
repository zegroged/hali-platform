import { NextRequest, NextResponse } from "next/server";
import { getBusinesses } from "@/lib/businesses";

// Geçersiz/aralık-dışı sayı → undefined (NaN ile sıralamayı/mesafeyi bozma).
function num(v: string | null, min?: number, max?: number): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  if (min != null && n < min) return undefined;
  if (max != null && n > max) return undefined;
  return n;
}

// GET /api/businesses?district=Kadıköy  veya  ?lat=..&lng=..
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = num(sp.get("lat"), -90, 90);
  const lng = num(sp.get("lng"), -180, 180);

  const sortParam = sp.get("sort");
  const sort =
    sortParam === "rating" || sortParam === "fastest" ? sortParam : undefined;

  const businesses = await getBusinesses({
    city: sp.get("city") ?? undefined,
    district: sp.get("district") ?? undefined,
    // lat/lng yalnız İKİSİ de geçerliyse kullanılır (yarım koordinat mesafeyi bozar)
    lat: lat != null && lng != null ? lat : undefined,
    lng: lat != null && lng != null ? lng : undefined,
    maxPrice: num(sp.get("maxPrice"), 0),
    minRating: num(sp.get("minRating"), 0, 5),
    openNow: sp.get("openNow") === "1",
    sort,
  });

  return NextResponse.json({ count: businesses.length, businesses });
}
