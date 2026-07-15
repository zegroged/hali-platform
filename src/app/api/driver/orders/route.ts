import { NextResponse } from "next/server";
import { currentDriverId, listDriverOrders } from "@/lib/driverOrders";

// Native şoför uygulaması: bu şoföre atanmış aktif siparişler.
export async function GET() {
  const driverId = await currentDriverId();
  if (!driverId)
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const orders = await listDriverOrders(driverId);
  return NextResponse.json({ orders });
}
