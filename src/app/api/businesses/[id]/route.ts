import { NextResponse } from "next/server";
import { getBusinessById } from "@/lib/businesses";

// Tekil halıcı profili — native müşteri uygulaması için (web sunucu tarafında doğrudan getBusinessById kullanıyor)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const b = await getBusinessById(id);
  if (!b) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(b);
}
