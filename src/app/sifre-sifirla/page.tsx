import type { Metadata } from "next";
import Link from "next/link";
import { PendingButton } from "@/components/PendingButton";
import { bileteBak } from "@/lib/passwordReset";
import { sifreyiYaz } from "./actions";

// SIFIRLAMA FORMU — e-postadaki bağlantıyla gelinir. Oturum GEREKMEZ.
export const metadata: Metadata = {
  title: "Yeni Şifre Belirle",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const inp =
  "w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand focus:outline-none";

export default async function SifreSifirlaPage({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string; hata?: string }>;
}) {
  const { jeton, hata } = await searchParams;
  const durum = await bileteBak(String(jeton ?? ""));

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-10">
      <h1 className="text-lg font-semibold text-slate-900">
        Yeni Şifre Belirle
      </h1>

      {!durum.ok ? (
        <>
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {durum.hata} Yeni bir bağlantı isteyip tekrar dene.
          </p>
          <Link
            href="/sifremi-unuttum"
            className="inline-block rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand-dark"
          >
            Yeni bağlantı iste
          </Link>
        </>
      ) : (
        <>
          {hata && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {hata}
            </p>
          )}
          <form
            action={sifreyiYaz}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
          >
            <input type="hidden" name="jeton" value={jeton} />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Yeni şifre (en az 8 karakter)
              </label>
              <input
                name="yeni"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                className={inp}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Yeni şifre (tekrar)
              </label>
              <input
                name="tekrar"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                className={inp}
              />
            </div>
            <PendingButton className="w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand-dark">
              Şifremi Kaydet
            </PendingButton>
          </form>
          <p className="text-xs text-slate-500">
            Kaydettikten sonra giriş sayfasına yönlendirilirsin. Telefon
            uygulaması kullanıyorsan orada yeniden giriş yapman gerekir.
          </p>
        </>
      )}
    </div>
  );
}
