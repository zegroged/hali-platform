"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness, syncVisibility } from "@/lib/panel";
import { initSubscriptionCheckout, cancelRecurring } from "@/lib/iyzico";
import { getAppBaseUrl } from "@/lib/config";
import { ensureBillingCode } from "@/lib/billing";
import { effectiveSubscriptionGross } from "@/lib/discount";
import { extendSubscription } from "@/lib/subscription";
import { isRealMobilePhone, normalizePhone } from "@/lib/phone";

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
  // (mali müşavir /muhasebe'de görür). Ünvan + vergi dairesi + fatura adresi
  // eksikse ödeme yok.
  if (
    !b.billingTitle?.trim() ||
    !b.taxOffice?.trim() ||
    !b.billingAddress?.trim()
  ) {
    redirect("/panel/profil?odeme=fatura");
  }
  // iyzico alıcı GSM'ini operatör koduyla doğrular (0500 gibi tahsissiz kodlar
  // "Geçersiz telefon numarası" ile reddedilir). Sahip numarası uygun değilse
  // işletmenin diğer numaralarını dene; hiçbiri olmazsa anlaşılır uyarı ver.
  const gsmAday = [b.owner.phone, b.gsmPhone2, b.phone]
    .map((x) => normalizePhone(x ?? ""))
    .find((x) => isRealMobilePhone(x));
  if (!gsmAday) redirect("/panel/profil?odeme=cep");

  // Emniyet kemeri: kodu olmayan eski hesaba ödeme öncesi cari kodu ata.
  if (!b.billingCode) await ensureBillingCode(b.id).catch(() => {});

  // İNDİRİM (premium komisyoncu kodu ya da admin eli): süre geçerliyken her
  // tahsilat indirimli tutardan yapılır. Callback tutar doğrulaması payment
  // kaydındaki amount ile karşılaştırdığından otomatik tutarlıdır.
  const { gross, pct } = effectiveSubscriptionGross(b);

  // KÖTÜYE KULLANIM FRENİ (inceleme bulgusu): İNDİRİMLİYKEN erken yenileme
  // YASAK — dönem sonuna 3 günden fazla varsa indirimli tahsilat/bedava dönem
  // açılmaz. Yoksa kısa süreli yüksek indirimle (%90/1 ay gibi) arka arkaya
  // ödeme yapıp yıllarca indirimli dönem stoklanabilirdi. İndirimsiz TAM fiyat
  // erken yenileme serbest kalır (parasını veren yığar).
  const ERKEN_ESIK_MS = 3 * 24 * 60 * 60 * 1000;
  if (pct != null) {
    // Taze oku — b istek başında okundu, bayat olabilir (TOCTOU).
    const taze = await prisma.subscription.findUnique({
      where: { businessId: b.id },
      select: { currentPeriodEnd: true },
    });
    const son = taze?.currentPeriodEnd?.getTime() ?? 0;
    if (son > Date.now() + ERKEN_ESIK_MS) {
      redirect("/panel/abonelik?durum=indirimli-erken");
    }
  }

  // %100 indirim (tutar 1 TL altı): iyzico'suz dönem aç — 0 TL'lik PAID kaydı
  // izlenebilirlik için tutulur (komisyon tahakkuku 0 tutarda işlemez, mali
  // müşavir fatura listesine de düşmez).
  if (gross <= 0) {
    try {
      await prisma.$transaction(async (tx) => {
        // Yarışa dayanıklı fren (TOCTOU bulgusu): satırı KİLİTLEYEREK taze oku —
        // paralel istekler burada sıralanır, kaybeden güncel dönem sonunu görüp
        // reddedilir (yukarıdaki kilitsiz kontrol yalnız dostane kısa devre).
        const rows = await tx.$queryRaw<{ end: Date }[]>`
          SELECT "currentPeriodEnd" AS "end" FROM "Subscription"
          WHERE "businessId" = ${b.id} FOR UPDATE`;
        const kilitliSon = rows[0]?.end?.getTime() ?? 0;
        if (kilitliSon > Date.now() + ERKEN_ESIK_MS) throw new Error("erken");
        const end = await extendSubscription(tx, b.id);
        // Emniyet kemeri: tek istek EN FAZLA 1 dönem açabilir. Subscription
        // satırı henüz yokken iki paralel isteğin INSERT/ON CONFLICT yarışı
        // gibi kalan her delikte sonuç 34 günü aşar → geri al.
        if (end.getTime() > Date.now() + 34 * 24 * 60 * 60 * 1000)
          throw new Error("yigilma");
        await tx.subscriptionPayment.create({
          data: {
            businessId: b.id,
            status: "PAID",
            amount: 0,
            paidAt: new Date(),
            periodStart: new Date(),
            periodEnd: end,
          },
        });
      });
    } catch {
      redirect("/panel/abonelik?durum=ucretsiz-erken");
    }
    await syncVisibility(b.id);
    revalidatePath("/panel/abonelik");
    revalidatePath("/panel");
    redirect("/panel/abonelik?durum=ucretsiz");
  }

  const payment = await prisma.subscriptionPayment.create({
    data: {
      businessId: b.id,
      status: "PENDING",
      amount: gross,
    },
  });

  const base = getAppBaseUrl();
  const r = await initSubscriptionCheckout({
    paymentId: payment.id,
    price: gross,
    businessName: b.name,
    ownerName: b.owner.name,
    ownerEmail: b.owner.email!,
    ownerPhone: gsmAday!,
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
