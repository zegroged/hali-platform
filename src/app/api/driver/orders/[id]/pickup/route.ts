import { NextResponse } from "next/server";
import { currentDriverId, driverPickup } from "@/lib/driverOrders";

// multipart/form-data: photo (zorunlu) + carpetCount (opsiyonel, kaç halı alındı).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const driverId = await currentDriverId();
  if (!driverId)
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  // Eski sürüm uygulama bu alanı göndermez → null → eski davranış (2026-08-06).
  const r = await driverPickup(driverId, id, photo, form?.get("carpetCount"));
  if (!r.ok)
    return NextResponse.json({ error: r.error }, { status: r.code ?? 409 });
  return NextResponse.json({ ok: true });
}
