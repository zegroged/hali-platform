import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { initRecurringCheckout } from "@/lib/iyzico";
import {
  getAppBaseUrl,
  getIyzicoPlanReference,
  recurringEnabled,
} from "@/lib/config";

export const dynamic = "force-dynamic";

// Tekrarlayan abonelik başlat: iyzico Checkout Form'u SAYFAYA GÖMER (kartı
// iyzico'nun güvenli formunda alır). Ödeme sonrası callback aboneliği kaydeder.
export default async function AbonelikOde() {
  if (!recurringEnabled) redirect("/panel/abonelik?durum=hazir-degil");
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");
  if (!b.owner.email || !b.owner.emailVerified) redirect("/panel?odeme=eposta");
  const identity = (b.taxNumber ?? "").replace(/\D/g, "");
  if (identity.length < 10) redirect("/panel/profil?odeme=vergino");

  const [name, ...rest] = b.owner.name.trim().split(" ");
  const surname = rest.join(" ") || name;
  const gsm =
    "+90" + b.owner.phone.replace(/\D/g, "").replace(/^90/, "").replace(/^0/, "");

  const payment = await prisma.subscriptionPayment.create({
    data: { businessId: b.id, status: "PENDING", amount: 2400 },
  });

  const base = getAppBaseUrl();
  const r = await initRecurringCheckout({
    conversationId: payment.id,
    planReferenceCode: getIyzicoPlanReference(),
    callbackUrl: `${base}/api/pay/iyzico/subscription/recurring-callback`,
    name,
    surname,
    email: b.owner.email,
    gsmNumber: gsm,
    identityNumber: identity,
    address: b.address || b.district,
    city: b.city,
  });

  if (!r.ok) {
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    return (
      <div className="mx-auto max-w-lg space-y-4 p-2">
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Ödeme başlatılamadı: {r.error ?? "bilinmeyen hata"}
        </p>
        <Link href="/panel/abonelik" className="text-sm text-brand-dark underline">
          ← Aboneliğe dön
        </Link>
      </div>
    );
  }

  // iyzico bazı yapılandırmalarda hosted sayfa URL'i döndürür → oraya git.
  if (r.paymentPageUrl) redirect(r.paymentPageUrl);

  // Aksi halde form içeriğini (script) sayfaya göm — iyzico formu burada çizer.
  return (
    <div className="mx-auto max-w-lg space-y-4 p-2">
      <Link href="/panel/abonelik" className="text-sm text-brand-dark underline">
        ← Vazgeç
      </Link>
      <h1 className="text-lg font-semibold text-slate-900">
        Aboneliği Başlat — Düzenli Ödeme Talimatı
      </h1>
      <p className="text-sm text-slate-600">
        Kartın <strong>iyzico&apos;nun güvenli formunda</strong> alınır ve
        saklanır. Onayınla birlikte <strong>iptal edene kadar her ay 2.400 TL
        </strong> (KDV dahil) kartından otomatik çekilir.
      </p>
      {/* iyzico checkout form script'i — kart formunu bu div'e çizer */}
      <div dangerouslySetInnerHTML={{ __html: r.checkoutFormContent ?? "" }} />
    </div>
  );
}
