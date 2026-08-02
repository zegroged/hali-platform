import type { Metadata } from "next";
import Link from "next/link";
import { PendingButton } from "@/components/PendingButton";
import { biletIste } from "./actions";

// ŞİFREMİ UNUTTUM — tüm roller (2026-08-02). Hesap ifşası yok: kimlik kayıtlı
// olsun olmasın ekran hep aynı cevabı verir.
export const metadata: Metadata = {
  title: "Şifremi Unuttum",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SifremiUnuttumPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const { ok, hata } = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-10">
      <Link href="/giris" className="text-sm text-brand hover:underline">
        ← Giriş sayfası
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Şifremi Unuttum
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Hesabına kayıtlı <strong>e-posta adresini</strong> ya da{" "}
          <strong>kullanıcı adını</strong> yaz. Sıfırlama bağlantısını
          e-postana göndeririz.
        </p>
      </div>

      {ok && (
        <p
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Kayıtlı bir hesap bulunduysa sıfırlama bağlantısı e-postaya gönderildi.
          Gelen kutunu (ve spam klasörünü) kontrol et — bağlantı 1 saat geçerli.
        </p>
      )}
      {hata && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {hata}
        </p>
      )}

      <form
        action={biletIste}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            E-posta veya kullanıcı adı
          </label>
          <input
            name="kimlik"
            required
            autoComplete="username"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand focus:outline-none"
          />
        </div>
        <PendingButton className="w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand-dark">
          Sıfırlama bağlantısı gönder
        </PendingButton>
      </form>

      <p className="text-xs text-slate-500">
        Hesabında kayıtlı e-posta yoksa bağlantı gönderilemez — bu durumda
        yöneticinle görüş, sana geçici şifre üretsin. (Komisyoncuysan panelindeki{" "}
        <strong>&quot;Şifremi Değiştir&quot;</strong> sayfasından e-postanı
        ekleyip doğrulayabilirsin.)
      </p>
    </div>
  );
}
