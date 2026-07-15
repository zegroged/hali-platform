import { NextResponse } from "next/server";
import { currentDriverId, driverAccept } from "@/lib/driverOrders";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const driverId = await currentDriverId();
  if (!driverId)
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const { id } = await params;
  const r = await driverAccept(driverId, id);
  if (!r.ok)
    return NextResponse.json({ error: r.error }, { status: r.code ?? 409 });
  return NextResponse.json({ ok: true });
}
