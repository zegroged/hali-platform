import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { OrderForm } from "@/components/OrderForm";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

// generateMetadata + sayfa aynı sorguyu paylaşsın diye tek render içinde önbellekle.
const getBusiness = cache(async (id: string) =>
  prisma.cleanerBusiness.findFirst({
    where: { id, isVisible: true },
    select: { id: true, name: true, pausedUntil: true },
  }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) {
    return { title: "İşletme bulunamadı", robots: { index: false } };
  }
  return { title: `Sipariş — ${business.name}` };
}

export default async function SiparisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onceki?: string }>;
}) {
  const { id } = await params;
  const { onceki } = await searchParams;
  const business = await getBusiness(id);
  if (!business) notFound();

  // Tatil modu: işletme duraklattıysa form yerine bilgi göster.
  if (business.pausedUntil != null && business.pausedUntil > new Date()) {
    return (
      <>
        <main className="mx-auto max-w-lg px-4 py-6">
          <Link
            href={`/halici/${business.id}`}
            className="text-sm text-brand-dark hover:underline"
          >
            ← Profil
          </Link>
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <h1 className="font-semibold text-amber-900">
              {business.name} şu an yeni sipariş almıyor
            </h1>
            <p className="mt-1 text-sm text-amber-800">
              İşletme{" "}
              {business.pausedUntil.toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
              })}{" "}
              tarihine kadar siparişleri duraklattı. Dilersen bölgendeki diğer
              halıcılara bakabilirsin.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
            >
              Başka halıcı bul
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // "Tekrar sipariş": üye müşterinin AYNI işletmedeki eski siparişinden
  // ön-doldurma (sahiplik şart — başkasının sipariş kimliğiyle veri sızmaz).
  let initial:
    | {
        customerName: string;
        customerPhone: string;
        customerEmail: string;
        pickupAddress: string;
        approxM2: string;
        note: string;
        pickupLat?: number;
        pickupLng?: number;
      }
    | undefined;
  if (onceki) {
    const viewer = await getSessionUser();
    if (viewer?.role === "CUSTOMER") {
      const prev = await prisma.order.findFirst({
        where: { id: onceki, customerId: viewer.id, businessId: id },
        select: {
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          pickupAddress: true,
          approxM2: true,
          note: true,
          pickupLat: true,
          pickupLng: true,
        },
      });
      if (prev) {
        initial = {
          customerName: prev.customerName,
          customerPhone: prev.customerPhone,
          customerEmail: prev.customerEmail ?? "",
          pickupAddress: prev.pickupAddress,
          approxM2: prev.approxM2 != null ? String(prev.approxM2) : "",
          note: prev.note ?? "",
          pickupLat: prev.pickupLat ?? undefined,
          pickupLng: prev.pickupLng ?? undefined,
        };
      }
    }
  }

  return (
    <>
      <main className="mx-auto max-w-lg px-4 py-6">
        <Link
          href={`/halici/${business.id}`}
          className="text-sm text-brand-dark hover:underline"
        >
          ← Profil
        </Link>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Halımı Aldır
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">{business.name}</span> ·
          Ödeme teslimde — ön ödeme yok.
        </p>
        {initial && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Önceki siparişindeki bilgiler dolduruldu — kontrol edip onaylaman
            yeter.
          </p>
        )}
        <OrderForm
          businessId={business.id}
          businessName={business.name}
          initial={initial}
        />
      </main>
      <Footer />
    </>
  );
}
