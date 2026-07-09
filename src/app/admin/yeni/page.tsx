import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import NewBusinessForm from "@/components/NewBusinessForm";

export const dynamic = "force-dynamic";

// Admin'in doğrulama/ödeme olmadan işletme açtığı form. Oluşturulan hesap
// VERIFIED + süresiz ücretsiz abonelikle gelir; foto+şoför eklenince yayınlanır.
export default async function AdminNewBusiness({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") redirect("/giris");
  const { hata } = await searchParams;
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link
        href="/admin"
        className="text-sm font-medium text-brand-dark hover:underline"
      >
        ← Panele dön
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Yeni İşletme Oluştur
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Doğrulama ve ödeme gerektirmez. Hesap doğrulanmış + süresiz ücretsiz
          abonelikle açılır; fotoğraf ve en az bir şoför eklenince otomatik
          yayına girer.
        </p>
      </div>

      {hata && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {hata}
        </p>
      )}

      <NewBusinessForm />
    </div>
  );
}
