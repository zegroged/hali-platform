import NewBusinessForm from "@/components/NewBusinessForm";

export const dynamic = "force-dynamic";

// Müşteri hizmetlerinin tek işlevi: doğrulama/ödeme olmadan işletme açmak
// (adminin /admin/yeni yetkisinin aynısı). Başarı mesajı geçici şifreyi içerir.
export default async function DestekPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string; mesaj?: string }>;
}) {
  const { hata, mesaj } = await searchParams;
  return (
    <div className="mx-auto max-w-lg space-y-5">
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

      {mesaj && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {mesaj}
        </p>
      )}
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
