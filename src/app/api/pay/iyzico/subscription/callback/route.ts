import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrieveCheckout } from "@/lib/iyzico";
import { getAppBaseUrl, paymentsLive } from "@/lib/config";
import { extendSubscription } from "@/lib/subscription";
import { syncVisibility } from "@/lib/panel";
import { notifySubscriptionPaid } from "@/lib/paymentNotify";
import { accrueCommissionForPayment } from "@/lib/commission";

// iyzico abonelik ödemesi dönüşü. YALNIZ iyzico'nun kimlik-doğrulamalı sunucu
// yanıtına güvenir; tutarı beklenenle karşılaştırır; idempotenttir (çift
// callback/replay ikinci dönem AÇMAZ). Başarıda aboneliği 1 ay uzatır + yayına alır.
export async function POST(req: NextRequest) {
  const base = getAppBaseUrl();
  const ok = () =>
    NextResponse.redirect(new URL(`/panel?odeme=basarili`, base), 303);
  // 🔴 SESSİZ DÜŞÜŞ KAPATILDI (2026-08-07 denetimi, madde 4).
  // Bu fonksiyon parametresizdi ve HİÇBİR ŞEY LOGLAMIYORDU; altı ayrı daldan
  // dönülüyordu. Yani "para çekildi ama dönem açılmadı" hâli yaşandığında
  // sunucuda tek satır iz kalmıyor, kayıt sonsuza kadar PENDING kalıyordu.
  // İkiz uç (recurring-callback) bu düzeltmeyi almış, bu uç almamıştı —
  // oysa panelde CANLI olan düğme bu uca gidiyor.
  // ⚠️ Para akan hiçbir yolda sessiz düşüş bırakma (DEVIR §7).
  const fail = (sebep: string, ek?: Record<string, unknown>) => {
    console.error(
      `[iyzico-callback] BAŞARISIZ sebep=${sebep}` +
        (ek ? ` ${JSON.stringify(ek)}` : ""),
    );
    return NextResponse.redirect(new URL(`/panel?odeme=hata`, base), 303);
  };

  // Gerçek callback yalnız canlı modda anlamlı; mock modda dönem açma (para yok).
  if (!paymentsLive) return fail("odeme-modu-canli-degil");

  let token = "";
  try {
    const form = await req.formData();
    token = String(form.get("token") ?? "");
  } catch {
    const body = await req.json().catch(() => ({}));
    token = String(body?.token ?? "");
  }
  if (!token) return fail("token-yok");

  const r = await retrieveCheckout(token);
  if (!r.ok || !r.paid || !r.orderId)
    return fail("iyzico-sonuc-olumsuz", {
      token: token.slice(0, 12),
      ok: r.ok,
      paid: r.paid,
      orderId: r.orderId ?? null,
      hata: r.error ?? null,
    });

  // orderId = basketId = SubscriptionPayment.id (iyzico'dan gelir, client'a güvenilmez).
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: r.orderId },
  });
  if (!payment)
    return fail("kayit-bulunamadi", { orderId: r.orderId, token: token.slice(0, 12) });

  // TUTAR DOĞRULAMASI: tahsil edilen, beklenen abonelik bedeline eşit olmalı.
  const expected = Number(payment.amount);
  if (
    !Number.isFinite(expected) ||
    expected <= 0 ||
    r.paidPrice == null ||
    Math.abs(r.paidPrice - expected) > 0.01
  ) {
    return fail("tutar-uyusmuyor", {
      paymentId: payment.id,
      beklenen: expected,
      gelen: r.paidPrice,
    });
  }

  // ATOMİK claim + efekt (2026-07-09 güvenlik incelemesi): PAID işaretleme,
  // dönem açma ve kayda yazma AYNI transaction'da. Herhangi biri patlarsa PAID
  // geri alınır → kayıt PENDING kalır → iyzico retry baştan işleyip dönemi açar
  // ("ödendi ama hizmet yok" tutarsızlığı olmaz).
  let processed = false; // bu istekte dönem açıldı mı (idempotency)
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.subscriptionPayment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "PAID",
          paidAt: new Date(),
          iyzicoPaymentId: r.paymentId ?? null,
        },
      });
      if (claimed.count === 0) return; // zaten işlenmiş (çift callback) — no-op
      const end = await extendSubscription(tx, payment.businessId);
      await tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: { periodStart: new Date(), periodEnd: end },
      });
      processed = true;
    });
  } catch {
    // Transaction geri alındı → PENDING kaldı → iyzico retry'si işleyebilir.
    return fail("transaction-patladi", { paymentId: payment.id });
  }

  // Görünürlük idempotent; commit'ten SONRA, transaction dışında (yalnız bu
  // istekte gerçekten dönem açıldıysa yeterli — ama çift çalışması da zararsız).
  // Komisyoncu tahakkuku: KAPININ DIŞINDA — idempotent (paymentId @unique)
  // olduğundan replay'de de çağrılır; ilk denemede geçici hatayla yutulduysa
  // iyzico'nun tekrar callback'i tahakkuku tamamlar (inceleme bulgusu).
  await accrueCommissionForPayment(payment.id);

  if (processed) {
    await syncVisibility(payment.businessId);
    // Otomatik bilgilendirme: işletmeye makbuz + zil, admin'e FATURA KES maili.
    // processed guard'ı sayesinde çift callback'te İKİNCİ kez gitmez.
    const son = await prisma.subscriptionPayment.findUnique({
      where: { id: payment.id },
      select: { periodEnd: true },
    });
    await notifySubscriptionPaid({
      businessId: payment.businessId,
      amount: expected,
      periodEnd: son?.periodEnd ?? null,
      iyzicoPaymentId: r.paymentId ?? null,
      kind: "ilk-odeme",
    });
  }

  return ok();
}
