import { NextResponse } from "next/server";
import { currentDriverId, driverAdvance } from "@/lib/driverOrders";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const driverId = await currentDriverId();
  if (!driverId)
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    verbalConsent?: unknown;
  };
  const r = await driverAdvance(driverId, id, body.verbalConsent === true);
  if (!r.ok)
    return NextResponse.json({ error: r.error }, { status: r.code ?? 409 });
  return NextResponse.json({ ok: true });
}
