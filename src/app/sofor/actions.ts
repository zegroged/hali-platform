"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendSms, trackingLink } from "@/lib/sms";
import { getAppBaseUrl } from "@/lib/config";
import { DRIVER_NEXT } from "@/lib/orderStatus";
import { saveOrderPhotoFile } from "@/lib/orderPhoto";
import { ORDER_STATUS_META } from "@/lib/orderStatus";

async function currentDriver() {
  const u = await getSessionUser();
  if (!u || u.role !== "DRIVER") redirect("/giris");
  const d = await prisma.driver.findUnique({ where: { userId: u.id } });
  if (!d) redirect("/giris");
  return d;
}

export async function acceptOrder(formData: FormData) {
  const d = await currentDriver();
  const id = String(formData.get("orderId"));
  const o = await prisma.order.findFirst({
    where: { id, driverId: d.id, status: "CREATED" },
  });
  if (!o) return;
  await prisma.order.update({ where: { id }, data: { status: "ACCEPTED" } });
  await prisma.orderEvent.create({
    data: { orderId: id, status: "ACCEPTED", note: "Şoför kabul etti" },
  });
  revalidatePath("/sofor");
}

export async function rejectOrder(formData: FormData) {
  const d = await currentDriver();
  const id = String(formData.get("orderId"));
  const preset = String(formData.get("reason") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const reason = [preset || "Belirtilmedi", note].filter(Boolean).join(" — ");
  const o = await prisma.order.findFirst({
    where: { id, driverId: d.id, status: "CREATED" },
  });
  if (!o) return;
  await prisma.order.update({
    where: { id },
    data: { status: "REJECTED", rejectReason: reason },
  });
  await prisma.orderEvent.create({
    data: { orderId: id, status: "REJECTED", note: `Reddedildi: ${reason}` },
  });
  // SMS başarısızlığı iş akışını bozmasın (DB güncellemesi zaten yapıldı).
  try {
    await sendSms(
      o.customerPhone,
      `Talebiniz maalesef karşılanamadı. Sebep: ${reason}. Başka halıcı seçebilirsiniz: ${getAppBaseUrl()}/halicilar`,
    );
  } catch (e) {
    console.error("rejectOrder SMS hatası:", e);
  }
  revalidatePath("/sofor");
}

// Halıyı alırken para alınmaz; sadece fotoğraf/kayıt. Tahsilat teslimde.
export async function savePickup(formData: FormData) {
  const d = await currentDriver();
  const id = String(formData.get("orderId"));
  const o = await prisma.order.findFirst({
    where: { id, driverId: d.id, status: "ACCEPTED" },
  });
  if (!o) return;

  // Gerçek dosya yüklemesi (kamera/galeri) — geçersizse null, akış bloklanmaz.
  const photoUrl = await saveOrderPhotoFile(
    formData.get("photo"),
    o.businessId,
    o.id,
  );

  await prisma.order.update({
    where: { id },
    data: { status: "PICKED_UP", pickupPhotoUrl: photoUrl },
  });
  await prisma.orderEvent.create({
    data: { orderId: id, status: "PICKED_UP", note: "Halı alındı" },
  });
  revalidatePath("/sofor");
}

// Ara adımlar: alındı -> yıkanıyor -> yola çıktı. Teslim/tahsilat ayrı (deliverOrder).
export async function advanceOrder(formData: FormData) {
  const d = await currentDriver();
  const id = String(formData.get("orderId"));
  const o = await prisma.order.findFirst({
    where: { id, driverId: d.id, status: { in: ["PICKED_UP", "WASHING"] } },
  });
  if (!o) return;
  const next = DRIVER_NEXT[o.status];
  if (!next) return;

  await prisma.order.update({ where: { id }, data: { status: next } });
  await prisma.orderEvent.create({
    data: { orderId: id, status: next, note: ORDER_STATUS_META[next].label },
  });

  if (next === "OUT_FOR_DELIVERY") {
    // B9: önceki teslimatın konumu sızmasın — sonraki ping'e kadar konumu temizle.
    await prisma.driver.update({
      where: { id: d.id },
      data: { lastLat: null, lastLng: null },
    });
    // B8: yüksek değerli tek bildirim — müşteri artık canlı takip edebilir (ASCII = 1 SMS).
    try {
      await sendSms(
        o.customerPhone,
        `Haliniz yola cikti! Canli takip: ${trackingLink(o.code ?? o.trackingToken)}`,
      );
    } catch (e) {
      console.error("advanceOrder SMS hatası:", e);
    }
  }
  revalidatePath("/sofor");
}

// Teslim anında tahsilat — Türk usulü: önce iş görülür, sonra ödeme alınır.
// NAKİT: teslimde tahsil → PAID. KART: tutar belirlenir, müşteri iyzico ile öder
// (init→callback PAID yapar); burada kart ÇEKİLMEZ (server-side kart çekimi yok).
export async function deliverOrder(formData: FormData) {
  const d = await currentDriver();
  const id = String(formData.get("orderId"));
  const price = Number(formData.get("price"));

  // Geçersiz/sıfır/negatif tutar sessizce yutulmasın → şoför net hata görsün.
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Geçerli bir teslim tutarı girin (0'dan büyük).");
  }

  const o = await prisma.order.findFirst({
    where: { id, driverId: d.id, status: "OUT_FOR_DELIVERY" },
  });
  if (!o) return;

  const isCash = o.paymentMethod === "CASH";
  // Nakitte teslimde tahsil edilir; kartta ödeme iyzico callback'ine bırakılır.
  const paymentStatus = isCash ? "PAID" : o.paymentStatus;

  // CAS: yalnız hâlâ OUT_FOR_DELIVERY ise güncelle → çift tık / çift teslim engeli.
  const updated = await prisma.order.updateMany({
    where: { id, status: "OUT_FOR_DELIVERY" },
    data: {
      status: "DELIVERED",
      priceTotal: price,
      // Komisyon yalnız tahsilat gerçekleşince yazılır: nakit→şimdi (0),
      // kart→callback'te PAID ile birlikte (B6, çift-yazım yok).
      commission: isCash ? 0 : undefined,
      paymentStatus,
    },
  });
  if (updated.count === 0) return; // başka istek önce teslim etti

  // Teslim kanıtı fotoğrafı: patron Özet'te görür, müşteri takipte görür.
  const deliveryPhotoUrl = await saveOrderPhotoFile(
    formData.get("photo"),
    o.businessId,
    id,
  );
  if (deliveryPhotoUrl) {
    await prisma.order.update({
      where: { id },
      data: { deliveryPhotoUrl },
    });
  }

  const note =
    o.paymentMethod === "CASH"
      ? `Teslim edildi · ${price} TL nakit tahsil edildi`
      : `Teslim edildi · ${price} TL (kartla ödeme bekleniyor)`;
  await prisma.orderEvent.create({
    data: { orderId: id, status: "DELIVERED", note },
  });
  revalidatePath("/sofor");
}
