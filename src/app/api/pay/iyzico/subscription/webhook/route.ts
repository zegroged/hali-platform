import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extendSubscription } from "@/lib/subscription";
import { notifySubscriptionPaid } from "@/lib/paymentNotify";
import { accrueCommissionForPayment } from "@/lib/commission";
import { syncVisibility } from "@/lib/panel";
import { paymentsLive, getIyzicoPlanAmount } from "@/lib/config";

// iyzico tekrarlayan abonelik WEBHOOK'u — her aylık otomatik çekimde iyzico
// buraya POST eder. Başarılı çekimde dönemi 1 ay uzatır; başarısızda PAST_DUE.
// iyzico panelinde webhook URL'i olarak bu adres tanımlanır:
//   https://enyakinhaliyikamaservisi.com/api/pay/iyzico/subscription/webhook
// NOT: iyzico'nun gönderdiği alan adları hesap/sürüme göre değişebildiğinden
// olası anahtarlar defansif okunur; canlıya almadan önce gerçek payload ile teyit.
export async function POST(req: NextRequest) {
  if (!paymentsLive) return NextResponse.json({ ok: true });

  // KİMLİK DOĞRULAMA (denetim bulgusu): webhook imzasız/açıktı — subRef bilen
  // saldırgan {…,SUCCESS} POST'uyla bedava abonelik uzatabiliyordu. iyzico
  // panelinde webhook URL'ine ?key=<IYZICO_WEBHOOK_SECRET> ekle; sır tanımlıysa
  // eşleşmeyen istekler reddedilir. (Sır yoksa — henüz kurulmadıysa — recurring
  // zaten gated; yine de log'la ve işleme.)
  const secret = process.env.IYZICO_WEBHOOK_SECRET;
  if (secret) {
    const key =
      req.nextUrl.searchParams.get("key") ?? req.headers.get("x-webhook-key");
    if (key !== secret) {
      return NextResponse.json({ error: "yetkisiz" }, { status: 401 });
    }
  }

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
  // İdempotency anahtarı: iyzico'nun bu çekim/olay için gönderdiği benzersiz id.
  const eventId = String(
    body.paymentId ??
      body.iyzicoPaymentId ??
      body.orderReferenceCode ??
      body.referenceCode ??
      "",
  );
  if (!subRef) return NextResponse.json({ ok: true }); // bağsız event — yut

  const sub = await prisma.subscription.findFirst({
    where: { iyzicoSubRef: subRef },
    select: { businessId: true },
  });
  if (!sub) return NextResponse.json({ ok: true }); // bize ait değil

  const success = /SUCCESS|PAID|ACTIVE|ORDER.*SUCCESS/.test(eventType);
  const failure = /FAIL|UNPAID|PAST_DUE|CANCEL|EXPIRE/.test(eventType);

  if (success) {
    // NULL İDEMPOTENCY GUARD (denetim bulgusu): eventId boşsa iyzicoPaymentId
    // null yazılırdı; Postgres @unique çoklu NULL'a izin verdiğinden aynı
    // id'siz success olayının HER tekrarı +30 gün eklerdi. Anahtarsız olayda
    // dönem AÇMA — tekillik garanti edilemez. (Gerçek çekimde iyzico id gönderir.)
    if (!eventId) {
      console.warn("iyzico webhook: id'siz success olayı — dönem açılmadı", {
        subRef,
      });
      return NextResponse.json({ ok: true, skipped: "no-event-id" });
    }
    // İDEMPOTENCY: iyzico webhook'ları en-az-bir-kez teslim edilir; çift teslim
    // çift 30 gün + çift ödeme kaydı üretiyordu. iyzicoPaymentId @unique ile
    // ATOMİK claim — daha önce işlendiyse create P2002 fırlatır, no-op döner.
    // Çekilen tutar: bağlı planın fiyatı (.env IYZICO_PLAN_AMOUNT; doğrulama
    // döneminde 1 TL). Sabit 2400 yazmak yanlış makbuz/komisyon üretirdi.
    const cekilen = getIyzicoPlanAmount();
    let yeniDonemSonu: Date | null = null;
    let yeniOdemeId: string | null = null;
    try {
      await prisma.$transaction(async (tx) => {
        const end = await extendSubscription(tx, sub.businessId);
        yeniDonemSonu = end;
        const olusan = await tx.subscriptionPayment.create({
          data: {
            businessId: sub.businessId,
            status: "PAID",
            amount: cekilen,
            paidAt: new Date(),
            periodStart: new Date(),
            periodEnd: end,
            // eventId burada garanti dolu (yukarıda boşsa erken döndük) →
            // @unique ile gerçek idempotency.
            iyzicoPaymentId: eventId,
          },
        });
        yeniOdemeId = olusan.id;
      });
      await syncVisibility(sub.businessId);
      // Komisyoncu tahakkuku (varsa) — idempotent, best-effort.
      if (yeniOdemeId) await accrueCommissionForPayment(yeniOdemeId);
      // Otomatik bilgilendirme (best-effort): makbuz + zil + admin FATURA KES.
      // Idempotency claim'i gectik = bu olay ILK kez islendi, cift mail gitmez.
      await notifySubscriptionPaid({
        businessId: sub.businessId,
        amount: cekilen,
        periodEnd: yeniDonemSonu,
        iyzicoPaymentId: eventId,
        kind: "yenileme",
      });
    } catch (e) {
      // Prisma P2002 = bu eventId zaten işlendi → sessizce yut (idempotent).
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code?: string }).code === "P2002"
      ) {
        // Replay: ödeme satırı zaten var — tahakkuk eksikse tamamla (idempotent).
        const mevcut = await prisma.subscriptionPayment.findUnique({
          where: { iyzicoPaymentId: eventId },
          select: { id: true },
        });
        if (mevcut) await accrueCommissionForPayment(mevcut.id);
        return NextResponse.json({ ok: true, duplicate: true });
      }
      throw e;
    }
  } else if (failure) {
    // Çekim başarısız → PAST_DUE (dönem sonunda subscriptionActive false olur).
    await prisma.subscription.updateMany({
      where: { businessId: sub.businessId },
      data: { status: "PAST_DUE" },
    });
  }

  return NextResponse.json({ ok: true });
}
