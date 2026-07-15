import { NextResponse } from "next/server";
import { currentDriverId, driverDeliver } from "@/lib/driverOrders";

// multipart/form-data: photo (zorunlu) + price. Teslim + tahsilat.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const driverId = await currentDriverId();
  if (!driverId)
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  if (!form)
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  const price = Number(form.get("price"));
  const photo = form.get("photo");
  const r = await driverDeliver(driverId, id, price, photo);
  if (!r.ok)
    return NextResponse.json({ error: r.error }, { status: r.code ?? 409 });
  return NextResponse.json({ ok: true });
}
