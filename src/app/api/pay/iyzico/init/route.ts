import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { initCheckout } from "@/lib/iyzico";
import { getAppBaseUrl } from "@/lib/config";

// Bir sipariş için iyzico ödeme sayfası başlatır → müşteriye kart girişi URL'i döner.
// Yetki: ham orderId YETERLİ DEĞİL (IDOR). Çağıran, siparişin takip token'ını VEYA
// 6 haneli kodunu (müşterinin kişisel sırrı) bilmeli — böylece yalnız kendi siparişi.
const Body = z.object({ token: z.string().min(4).max(64) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "token gerekli" }, { status: 400 });
  }
  const token = parsed.data.token;

  const o = await prisma.order.findFirst({
    // Kod büyük harf saklanır; takip token'ı case-sensitive (B7 tutarlılık).
    where: { OR: [{ trackingToken: token }, { code: token.toUpperCase() }] },
  });
  if (!o) {
    return NextResponse.json({ error: "Sipariş yok" }, { status: 404 });
  }
  if (o.paymentStatus === "PAID") {
    return NextResponse.json({ error: "Sipariş zaten ödenmiş" }, { status: 409 });
  }

  const price = o.priceTotal ? Number(o.priceTotal) : 0;
  if (!(price > 0)) {
    return NextResponse.json(
      { error: "Tutar belirlenmemiş (şoför tutarı girmeli)" },
      { status: 400 },
    );
  }

  const base = getAppBaseUrl();
  const r = await initCheckout({
    orderId: o.id,
    price,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    address: o.pickupAddress,
    callbackUrl: `${base}/api/pay/iyzico/callback`,
  });
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  return NextResponse.json({
    paymentPageUrl: r.paymentPageUrl,
    token: r.token,
    mock: r.mock ?? false,
  });
}
