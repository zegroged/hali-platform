import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { initRecurringCheckout } from "@/lib/iyzico";
import {
  getAppBaseUrl,
  getIyzicoPlanReference,
  getIyzicoPlanAmount,
  recurringEnabled,
} from "@/lib/config";
import { activeDiscountPercent } from "@/lib/discount";
import { pickIyzicoGsm } from "@/lib/phone";
import { IyzicoFormGuard } from "@/components/IyzicoFormGuard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

// TALİMAT (recurring) ÖDEME SAYFASI — bilerek PANEL DIŞINDA (2026-07-25):
// iyzico abonelik akışı barındırılan ödeme sayfası DÖNDÜRMÜYOR (yalnız gömülü
// form; sunucuda doğrulandı: yanıtta paymentPageUrl yok), form da 3D Secure
// için tam ekran katman açıyor. Panel başlığı/menüsünün içinde çizilince ödeme
// ekranı panel çerçevesinin ARKASINDA kalıyordu. Burada sayfada başka hiçbir
// katman yok; yetki kontrolü sayfanın kendisinde (panel layout'una bağlı değil).
export default async function AbonelikTalimatOde() {
  if (!recurringEnabled) redirect("/panel/abonelik?durum=hazir-degil");
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");
  if (!b.owner.email || !b.owner.emailVerified) redirect("/panel?odeme=eposta");
  const identity = (b.taxNumber ?? "").replace(/\D/g, "");
  if (identity.length < 10) redirect("/panel/profil?odeme=vergino");
  // İndirimli işletme recurring'e giremez (4.18): iyzico planı sabit fiyatlı.
  if (activeDiscountPercent(b) != null) {
    redirect("/panel/abonelik?durum=indirimli-talimat-yok");
  }

  const [name, ...rest] = b.owner.name.trim().split(" ");
  const surname = rest.join(" ") || name;
  const gsm = pickIyzicoGsm(b.owner.phone, b.gsmPhone2, b.phone);
  if (!gsm) redirect("/panel/profil?odeme=cep");

  const planTutar = getIyzicoPlanAmount();
  const payment = await prisma.subscriptionPayment.create({
    data: { businessId: b.id, status: "PENDING", amount: planTutar },
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
      <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Ödeme başlatılamadı: {r.error ?? "bilinmeyen hata"}
        </p>
        <Link href="/panel/abonelik" className="text-sm text-brand-dark underline">
          ← Aboneliğe dön
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
        <Link href="/panel/abonelik" className="text-sm text-brand-dark underline">
          ← Vazgeç
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">
          Aboneliği Başlat — Düzenli Ödeme Talimatı
        </h1>
        <p className="text-sm text-slate-600">
          Kartın <strong>iyzico&apos;nun güvenli formunda</strong> alınır ve
          saklanır. Onayınla birlikte{" "}
          <strong>
            iptal edene kadar her ay{" "}
            {planTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
          </strong>{" "}
          (KDV dahil) kartından otomatik çekilir.
        </p>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <strong>Not:</strong> Düzenli ödeme talimatı kartın saklanmasını
          gerektirir; bu yüzden <strong>KREDİ KARTI</strong> kullan. Banka
          (debit) kartları düzenli talimatta çoğu bankada kabul edilmez — banka
          kartıyla ödemek istersen abonelik sayfasındaki tek seferlik ödeme
          yolunu kullan.
        </p>
        {/* iyzico formu bu kaba çizer (id ZORUNLU — bundle bunu arar). */}
        <div id="iyzipay-checkout-form" className="responsive" />
        {/* İçerik <script> etiketleridir: React ile enjekte edilen script'ler
            ÇALIŞMAZ, tarayıcı yalnız TAM SAYFA yüklemesinde ayrıştırıp çalıştırır
            (bu yüzden buraya gelen bağlantı <a>). Guard: 10 sn'de çizilmezse
            sayfayı bir kez yeniler. */}
        <div dangerouslySetInnerHTML={{ __html: r.checkoutFormContent ?? "" }} />
        <IyzicoFormGuard />
      </div>
    </div>
  );
}
