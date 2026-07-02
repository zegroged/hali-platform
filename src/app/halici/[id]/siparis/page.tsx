import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OrderForm } from "@/components/OrderForm";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

// generateMetadata + sayfa aynı sorguyu paylaşsın diye tek render içinde önbellekle.
const getBusiness = cache(async (id: string) =>
  prisma.cleanerBusiness.findFirst({
    where: { id, isVisible: true },
    select: { id: true, name: true },
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

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
        <OrderForm businessId={business.id} businessName={business.name} />
      </main>
      <Footer />
    </>
  );
}
