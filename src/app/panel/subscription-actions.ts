"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { initSubscriptionCheckout, cancelRecurring } from "@/lib/iyzico";
import { getAppBaseUrl } from "@/lib/config";
import { PLAN } from "@/lib/plan";

// Halıcının abonelik ödemesini başlatır: SubscriptionPayment(PENDING) kaydı
// açar, iyzico Checkout Form başlatır ve tarayıcıyı iyzico'nun GÜVENLİ kart
// sayfasına yönlendirir. Kart bilgisi bizim sunucumuza hiç girmez (PCI).
export async function startSubscriptionPayment() {
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");

  // iyzico canlıda alıcı için geçerli e-posta + kimlik no ister.
  if (!b.owner.email || !b.owner.emailVerified) {
    redirect("/panel?odeme=eposta"); // önce e-posta doğrula
  }
  const identity = (b.taxNumber ?? "").replace(/\D/g, "");
  if (identity.length < 10) {
    redirect("/panel/profil?odeme=vergino"); // vergi/kimlik no gerekli
  }
  // FATURA BİLGİLERİ zorunlu: platform bu işletmeye abonelik faturası kesecek
  // (mali müşavir /muhasebe'de görür). Ünvan + vergi dairesi eksikse ödeme yok.
  if (!b.billingTitle?.trim() || !b.taxOffice?.trim()) {
    redirect("/panel/profil?odeme=fatura");
  }

  const payment = await prisma.subscriptionPayment.create({
    data: {
      businessId: b.id,
      status: "PENDING",
      amount: PLAN.priceGrossNumber,
    },
  });

  const base = getAppBaseUrl();
  const r = await initSubscriptionCheckout({
    paymentId: payment.id,
    price: PLAN.priceGrossNumber,
    businessName: b.name,
    ownerName: b.owner.name,
    ownerEmail: b.owner.email!,
    ownerPhone: b.owner.phone,
    identityNumber: identity,
    address: b.address || b.district,
    city: b.city,
    callbackUrl: `${base}/api/pay/iyzico/subscription/callback`,
  });

  if (!r.ok || !r.paymentPageUrl) {
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    redirect("/panel?odeme=hata");
  }

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: { iyzicoToken: r.token ?? null },
  });

  // iyzico'nun barındırdığı güvenli ödeme sayfasına git.
  redirect(r.paymentPageUrl!);
}

/**
 * Düzenli ödeme talimatını (tekrarlayan abonelik) iptal et. iyzico gelecek
 * çekimleri durdurur; mevcut dönem currentPeriodEnd'e kadar açık kalır
 * (para iadesi yok — tüketici lehine, ödenmiş dönem kullanılır).
 */
export async function cancelRecurringSubscription() {
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");
  const sub = b.subscription;
  if (!sub?.iyzicoSubRef || !sub.autoRenew) {
    redirect("/panel/abonelik?durum=talimat-yok");
  }
  const r = await cancelRecurring(sub.iyzicoSubRef!);
  if (!r.ok) {
    redirect("/panel/abonelik?durum=iptal-hata");
  }
  await prisma.subscription.update({
    where: { businessId: b.id },
    data: { autoRenew: false, canceledAt: new Date() },
  });
  revalidatePath("/panel/abonelik");
  revalidatePath("/panel");
  redirect("/panel/abonelik?durum=iptal-ok");
}
