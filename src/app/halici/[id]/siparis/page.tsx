import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OrderForm } from "@/components/OrderForm";

export const dynamic = "force-dynamic";

export default async function SiparisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await prisma.cleanerBusiness.findFirst({
    where: { id, isVisible: true },
    select: { id: true, name: true },
  });
  if (!business) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <Link
        href={`/halici/${business.id}`}
        className="text-sm text-brand-dark hover:underline"
      >
        ← Profil
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Halımı Aldır</h1>
      <OrderForm businessId={business.id} businessName={business.name} />
    </main>
  );
}
