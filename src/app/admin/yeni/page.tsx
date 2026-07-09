import Link from "next/link";
import { createBusinessByAdmin } from "../actions";

export const dynamic = "force-dynamic";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand";
const lbl = "mb-1 block text-xs font-medium text-slate-600";

// Admin'in doğrulama/ödeme olmadan işletme açtığı form. Oluşturulan hesap
// VERIFIED + süresiz ücretsiz abonelikle gelir; foto+şoför eklenince yayınlanır.
export default async function AdminNewBusiness({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
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

      <form
        action={createBusinessByAdmin}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <div>
          <label htmlFor="businessName" className={lbl}>
            İşletme adı
          </label>
          <input id="businessName" name="businessName" required className={inp} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ownerName" className={lbl}>
              Yetkili ad soyad
            </label>
            <input id="ownerName" name="ownerName" required className={inp} />
          </div>
          <div>
            <label htmlFor="phone" className={lbl}>
              Telefon (giriş için)
            </label>
            <input
              id="phone"
              name="phone"
              placeholder="05xxxxxxxxx"
              required
              className={inp}
            />
          </div>
        </div>
        <div>
          <label htmlFor="email" className={lbl}>
            E-posta
          </label>
          <input id="email" name="email" type="email" required className={inp} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="city" className={lbl}>
              İl
            </label>
            <input
              id="city"
              name="city"
              defaultValue="İstanbul"
              required
              className={inp}
            />
          </div>
          <div>
            <label htmlFor="district" className={lbl}>
              İlçe
            </label>
            <input id="district" name="district" required className={inp} />
          </div>
        </div>
        <div>
          <label htmlFor="taxNumber" className={lbl}>
            Vergi / T.C. kimlik no{" "}
            <span className="text-slate-400">(11 hane TC veya 10 hane VKN)</span>
          </label>
          <input id="taxNumber" name="taxNumber" className={inp} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="pricePerM2" className={lbl}>
              m² fiyatı (TL)
            </label>
            <input
              id="pricePerM2"
              name="pricePerM2"
              type="number"
              min="0"
              placeholder="45"
              className={inp}
            />
          </div>
          <div>
            <label htmlFor="minDays" className={lbl}>
              Teslim min (gün)
            </label>
            <input
              id="minDays"
              name="minDays"
              type="number"
              min="1"
              placeholder="2"
              className={inp}
            />
          </div>
          <div>
            <label htmlFor="maxDays" className={lbl}>
              Teslim max (gün)
            </label>
            <input
              id="maxDays"
              name="maxDays"
              type="number"
              min="1"
              placeholder="4"
              className={inp}
            />
          </div>
        </div>
        <button className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
          İşletmeyi Oluştur
        </button>
        <p className="text-xs text-slate-400">
          Oluşturunca geçici şifre gösterilir — sahibine ilet, girişten sonra
          panelden değiştirebilir. Fotoğraf ve şoför işletme panelinden eklenir.
        </p>
      </form>
    </div>
  );
}
