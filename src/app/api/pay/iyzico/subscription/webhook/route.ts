import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extendSubscription } from "@/lib/subscription";
import { syncVisibility } from "@/lib/panel";
import { paymentsLive } from "@/lib/config";

// iyzico tekrarlayan abonelik WEBHOOK'u — her aylık otomatik çekimde iyzico
// buraya POST eder. Başarılı çekimde dönemi 1 ay uzatır; başarısızda PAST_DUE.
// iyzico panelinde webhook URL'i olarak bu adres tanımlanır:
//   https://enyakinhaliyikamaservisi.com/api/pay/iyzico/subscription/webhook
// NOT: iyzico'nun gönderdiği alan adları hesap/sürüme göre değişebildiğinden
// olası anahtarlar defansif okunur; canlıya almadan önce gerçek payload ile teyit.
export async function POST(req: NextRequest) {
  if (!paymentsLive) return NextResponse.json({ ok: true });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const subRef = String(
    body.subscriptionReferenceCode ??
      body.referenceCode ??
      body.iyziReferenceCode ??
      "",
  );
  const eventType = String(
    body.iyziEventType ?? body.eventType ?? body.subscriptionStatus ?? "",
  ).toUpperCase();
  if (!subRef) return NextResponse.json({ ok: true }); // bağsız event — yut

  const sub = await prisma.subscription.findFirst({
    where: { iyzicoSubRef: subRef },
    select: { businessId: true },
  });
  if (!sub) return NextResponse.json({ ok: true }); // bize ait değil

  const success = /SUCCESS|PAID|ACTIVE|ORDER.*SUCCESS/.test(eventType);
  const failure = /FAIL|UNPAID|PAST_DUE|CANCEL|EXPIRE/.test(eventType);

  if (success) {
    // Aylık çekim başarılı → dönemi uzat + ödeme kaydı + görünürlük.
    await prisma.$transaction(async (tx) => {
      const end = await extendSubscription(tx, sub.businessId);
      await tx.subscriptionPayment.create({
        data: {
          businessId: sub.businessId,
          status: "PAID",
          amount: 2400,
          paidAt: new Date(),
          periodStart: new Date(),
          periodEnd: end,
        },
      });
    });
    await syncVisibility(sub.businessId);
  } else if (failure) {
    // Çekim başarısız → PAST_DUE (dönem sonunda subscriptionActive false olur).
    await prisma.subscription.updateMany({
      where: { businessId: sub.businessId },
      data: { status: "PAST_DUE" },
    });
  }

  return NextResponse.json({ ok: true });
}
