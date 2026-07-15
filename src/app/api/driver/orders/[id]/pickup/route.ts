import { NextResponse } from "next/server";
import { currentDriverId, driverPickup } from "@/lib/driverOrders";

// multipart/form-data: photo (zorunlu). Halı alım fotoğrafı.
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
  const r = await driverPickup(driverId, id, photo);
  if (!r.ok)
    return NextResponse.json({ error: r.error }, { status: r.code ?? 409 });
  return NextResponse.json({ ok: true });
}
