import { NextResponse } from "next/server";
import { currentDriverId, driverReject } from "@/lib/driverOrders";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const driverId = await currentDriverId();
  if (!driverId)
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    reason?: unknown;
    note?: unknown;
  };
  const r = await driverReject(
    driverId,
    id,
    typeof body.reason === "string" ? body.reason : "",
    typeof body.note === "string" ? body.note : "",
  );
  if (!r.ok)
    return NextResponse.json({ error: r.error }, { status: r.code ?? 409 });
  return NextResponse.json({ ok: true });
}
