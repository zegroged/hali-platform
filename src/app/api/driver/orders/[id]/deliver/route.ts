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
  // 🔴 TAHSİLAT BEYANI ARTIK OKUNUYOR (2026-08-11).
  //
  // `driverDeliver` bu iki alanı 2026-07-29'dan beri kabul ediyordu ve web
  // şoför ekranı gönderiyordu; AMA bu uç onları hiç okumuyordu. Yani mobil
  // uygulama alanı eklese bile sunucu sessizce atacaktı — iki halka birden
  // kopuktu. Mutabakatta "şoförde ne kadar nakit var" sorusunun cevabı buna
  // bağlı: IBAN'a geçen para şoförün üzerinde nakit BIRAKMAZ, ikisi
  // karışırsa halıcı şoförden olmayan parayı ister.
  //
  // Alan gelmezse eski davranış korunur (nakit = tahsil edildi) — Play'deki
  // eski sürümler kırılmasın. ⚠️ Yeni APK yayıldıktan sonra burası
  // sıkılaştırılmalı, yoksa eski sürümler sessizce eski davranışta kalır.
  const ham = form.get("tahsilat");
  const secim = typeof ham === "string" ? ham : null; // "CASH" | "IBAN" | "NO"
  const collected = secim == null ? undefined : secim !== "NO";
  const yontem = secim === "IBAN" ? "IBAN" : undefined;
  const r = await driverDeliver(driverId, id, price, photo, collected, yontem);
  if (!r.ok)
    return NextResponse.json({ error: r.error }, { status: r.code ?? 409 });
  return NextResponse.json({ ok: true });
}
