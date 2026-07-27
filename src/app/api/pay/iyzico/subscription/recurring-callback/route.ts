import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrieveRecurringResult, getRecurringPaymentId } from "@/lib/iyzico";
import { getAppBaseUrl, paymentsLive } from "@/lib/config";
import { extendSubscription } from "@/lib/subscription";
import { notifySubscriptionPaid } from "@/lib/paymentNotify";
import { accrueCommissionForPayment } from "@/lib/commission";
import { syncVisibility } from "@/lib/panel";

// Tekrarlayan abonelik Checkout dönüşü. iyzico'nun sunucu-sunucu doğrulamasıyla
// abonelik referansını alır, işletmenin aboneliğine yazar, ilk dönemi açar.
export async function POST(req: NextRequest) {
  const base = getAppBaseUrl();
  const ok = () =>
    NextResponse.redirect(new URL(`/panel/abonelik?durum=basladi`, base), 303);
  // SESSİZ BAŞARISIZLIK YASAK (2026-07-27): bu uç bir kez "hata" dedi ama iyzico
  // parayı ÇEKMİŞTİ; hiçbir yere log düşmediği için sebebi ancak iyzico panelinden
  // görülebildi. Artık her düşüş sebebiyle birlikte log'a yazılır.
  const fail = (sebep: string) => {
    console.error(`[abonelik-callback] BAŞARISIZ: ${sebep}`);
    return NextResponse.redirect(
      new URL(`/panel/abonelik?durum=hata`, base),
      303,
    );
  };

  if (!paymentsLive) return fail("ödeme canlı modda değil");

  let token = "";
  try {
    const form = await req.formData();
    token = String(form.get("token") ?? "");
  } catch {
    const body = await req.json().catch(() => ({}));
    token = String(body?.token ?? "");
  }
  if (!token) return fail("iyzico token göndermedi");

  const r = await retrieveRecurringResult(token);
  if (!r.ok) return fail(`iyzico sorgusu başarısız: ${r.error ?? "sebep yok"}`);
  if (!r.active) return fail("iyzico aboneliği ACTIVE döndürmedi");
  if (!r.subscriptionRef) return fail("iyzico abonelik referansı vermedi");

  // İdempotent: bu abonelik referansı zaten bağlanmışsa tekrar işleme.
  const existing = await prisma.subscription.findFirst({
    where: { iyzicoSubRef: r.subscriptionRef },
    select: { businessId: true },
  });
  if (existing) return ok();

  // ÖDEME KAYDINI BUL — İKİ YOL (2026-07-27, para kaybettiren hatanın düzeltmesi).
  // Önce TOKEN: ödeme sayfası bunu kaydediyor, iyzico'nun yankısına bağlı değil.
  // Sonra conversationId: iyzico yalnız SORGU isteğinde gönderilen değeri
  // yankılar — eskiden sorguya conversationId koymadığımız için boş dönüyor,
  // eşleşme tutmuyor ve para çekilmiş olmasına rağmen "hata" deniyordu.
  // "En son PENDING" tahminine ASLA düşmüyoruz (eşzamanlı abonelerde karışır).
  const marker =
    (await prisma.subscriptionPayment.findFirst({
      where: { iyzicoToken: token },
    })) ??
    (r.conversationId
      ? await prisma.subscriptionPayment.findUnique({
          where: { id: r.conversationId },
        })
      : null);
  if (!marker)
    return fail(
      `ödeme kaydı bulunamadı (token=${token.slice(0, 12)}…, conversationId=${r.conversationId ?? "yok"}) — abonelik ${r.subscriptionRef} iyzico'da AÇIK, elle eşitle`,
    );
  if (marker.status !== "PENDING") {
    // Replay: ödeme zaten işlenmiş — tahakkuk eksik kaldıysa tamamla (idempotent).
    if (marker.status === "PAID") await accrueCommissionForPayment(marker.id);
    return fail(`ödeme zaten işlenmiş (durum=${marker.status})`);
  }

  // ÇİFT TAHAKKUK KORUMASI (2026-07-28): iyzico'nun bu çekime ait ödeme
  // kimliğini al ve satıra yaz. Aynı çekim için webhook da gelirse
  // `iyzicoPaymentId` @unique kısıtına takılıp no-op olur; yazmazsak webhook
  // yeni satır açıp dönemi İKİNCİ KEZ uzatır ve komisyonu İKİNCİ KEZ işlerdi.
  const cekimId = await getRecurringPaymentId(r.subscriptionRef);
  if (cekimId) {
    // Webhook bizden önce davrandıysa iş bitmiştir — tekrar dönem açma.
    const zaten = await prisma.subscriptionPayment.findUnique({
      where: { iyzicoPaymentId: cekimId },
      select: { id: true },
    });
    if (zaten) {
      // Bu istekte açılan PENDING iz satırı boşta kalmasın.
      await prisma.subscriptionPayment
        .updateMany({
          where: { id: marker.id, status: "PENDING" },
          data: { status: "FAILED" },
        })
        .catch(() => {});
      return ok();
    }
  } else {
    console.warn(
      `[abonelik-callback] iyzico çekim kimliği alınamadı (ref=${r.subscriptionRef}) — webhook çift dönem açabilir, elle kontrol et`,
    );
  }

  // ATOMİK CLAIM (denetim bulgusu): PENDING kontrolü transaction dışında yapılıp
  // update koşulsuzdu — eşzamanlı iki callback ilk dönemi iki kez açabiliyordu.
  // Transaction içinde CAS: yalnız hâlâ PENDING olanı PAID'e çevir; count 0 ise
  // başka callback çoktan işledi → no-op.
  let claimed = false;
  await prisma.$transaction(async (tx) => {
    const claim = await tx.subscriptionPayment.updateMany({
      where: { id: marker.id, status: "PENDING" },
      data: {
        status: "PAID",
        paidAt: new Date(),
        periodStart: new Date(),
        // Idempotency anahtarı — webhook aynı çekimi tekrar işleyemesin.
        ...(cekimId ? { iyzicoPaymentId: cekimId } : {}),
      },
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
    // Komisyoncu tahakkuku (varsa) — idempotent, best-effort.
    await accrueCommissionForPayment(marker.id);
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
