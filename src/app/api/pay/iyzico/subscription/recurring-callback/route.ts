import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrieveRecurringResult } from "@/lib/iyzico";
import { getAppBaseUrl, paymentsLive } from "@/lib/config";
import { extendSubscription } from "@/lib/subscription";
import { notifySubscriptionPaid } from "@/lib/paymentNotify";
import { syncVisibility } from "@/lib/panel";

// Tekrarlayan abonelik Checkout dönüşü. iyzico'nun sunucu-sunucu doğrulamasıyla
// abonelik referansını alır, işletmenin aboneliğine yazar, ilk dönemi açar.
export async function POST(req: NextRequest) {
  const base = getAppBaseUrl();
  const ok = () =>
    NextResponse.redirect(new URL(`/panel/abonelik?durum=basladi`, base), 303);
  const fail = () =>
    NextResponse.redirect(new URL(`/panel/abonelik?durum=hata`, base), 303);

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

  const r = await retrieveRecurringResult(token);
  if (!r.ok || !r.active || !r.subscriptionRef || !r.conversationId) return fail();

  // İdempotent: bu abonelik referansı zaten bağlanmışsa tekrar işleme.
  const existing = await prisma.subscription.findFirst({
    where: { iyzicoSubRef: r.subscriptionRef },
    select: { businessId: true },
  });
  if (existing) return ok();

  // KESİN BAĞ: conversationId = ode sayfasının oluşturduğu SubscriptionPayment.id.
  // "En son PENDING" tahminine düşmüyoruz (eşzamanlı abonelerde karışırdı).
  const marker = await prisma.subscriptionPayment.findUnique({
    where: { id: r.conversationId },
  });
  if (!marker || marker.status !== "PENDING") return fail();

  // ATOMİK CLAIM (denetim bulgusu): PENDING kontrolü transaction dışında yapılıp
  // update koşulsuzdu — eşzamanlı iki callback ilk dönemi iki kez açabiliyordu.
  // Transaction içinde CAS: yalnız hâlâ PENDING olanı PAID'e çevir; count 0 ise
  // başka callback çoktan işledi → no-op.
  let claimed = false;
  await prisma.$transaction(async (tx) => {
    const claim = await tx.subscriptionPayment.updateMany({
      where: { id: marker.id, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date(), periodStart: new Date() },
    });
    if (claim.count === 0) return; // başka istek sahiplendi
    claimed = true;
    await tx.subscription.upsert({
      where: { businessId: marker.businessId },
      create: {
        businessId: marker.businessId,
        status: "ACTIVE",
        iyzicoSubRef: r.subscriptionRef,
        iyzicoCustomerRef: r.customerRef ?? null,
        autoRenew: true,
      },
      update: {
        status: "ACTIVE",
        iyzicoSubRef: r.subscriptionRef,
        iyzicoCustomerRef: r.customerRef ?? null,
        autoRenew: true,
        canceledAt: null,
      },
    });
    const end = await extendSubscription(tx, marker.businessId);
    await tx.subscriptionPayment.update({
      where: { id: marker.id },
      data: { periodEnd: end },
    });
  });
  if (claimed) {
    await syncVisibility(marker.businessId);
    // Otomatik bilgilendirme (best-effort; claimed guard'i cift maili engeller).
    const son = await prisma.subscriptionPayment.findUnique({
      where: { id: marker.id },
      select: { periodEnd: true },
    });
    await notifySubscriptionPaid({
      businessId: marker.businessId,
      amount: Number(marker.amount),
      periodEnd: son?.periodEnd ?? null,
      kind: "ilk-odeme",
    });
  }
  return ok();
}
