import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrieveCheckout } from "@/lib/iyzico";
import { getAppBaseUrl, paymentsLive } from "@/lib/config";
import { commissionFor } from "@/lib/payment";

// iyzico ödeme dönüşü (POST token). YALNIZ iyzico'nun kimlik-doğrulamalı yanıtına
// güvenir; tutarı sipariş tutarıyla karşılaştırır; idempotenttir.
export async function POST(req: NextRequest) {
  const base = getAppBaseUrl();
  // POST sonrası tarayıcıyı GET sayfasına yönlendir (303).
  const fail = () => NextResponse.redirect(new URL(`/takip?odeme=hata`, base), 303);

  // Gerçek callback yalnız canlı modda gelir; mock modda bu uç işlem yapmaz
  // (mock'un siparişi para almadan PAID yapmasını engeller).
  if (!paymentsLive) return fail();

  let token = "";
  try {
    const form = await req.formData();
    token = String(form.get("token") ?? "");
  } catch {
    const body = await req.json().catch(() => ({}));
    token = String(body?.token ?? "");
  }
  if (!token) return fail();

  const r = await retrieveCheckout(token);
  if (!r.ok || !r.paid || !r.orderId) return fail();

  // orderId/basketId iyzico'dan gelir; client'a güvenilmez.
  const order = await prisma.order.findUnique({ where: { id: r.orderId } });
  if (!order || order.paymentStatus === "PAID") return fail();

  // TUTAR DOĞRULAMASI: tahsil edilen, sipariş tutarına eşit olmalı (eksik ödeme istismarı).
  const expected = order.priceTotal != null ? Number(order.priceTotal) : NaN;
  if (
    !Number.isFinite(expected) ||
    expected <= 0 ||
    r.paidPrice == null ||
    Math.abs(r.paidPrice - expected) > 0.01
  ) {
    return fail();
  }

  // İdempotent: yalnız PENDING → PAID. Çift callback / replay ikinci kez güncellemez.
  const updated = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: "PENDING" },
    data: {
      paymentStatus: "PAID",
      paymentMethod: "CARD",
      commission: commissionFor("CARD", expected),
    },
  });
  if (updated.count === 0) return fail(); // başka istek önce işledi

  await prisma.orderEvent
    .create({
      data: { orderId: order.id, status: order.status, note: "Kartla ödeme alındı" },
    })
    .catch(() => null);

  const code = order.code ?? order.trackingToken;
  return NextResponse.redirect(new URL(`/takip/${code}?paid=1`, base), 303);
}
