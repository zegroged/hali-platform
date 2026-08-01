import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { PendingButton } from "@/components/PendingButton";
import { changeOwnPassword } from "./actions";

// ŞİFREMİ DEĞİŞTİR — tüm giriş yapmış roller için ORTAK sayfa (2026-08-02).
// Panellerden 🔑 bağlantısıyla gelinir; rol bazlı geri dönüş linki verilir.
export const metadata: Metadata = {
  title: "Şifremi Değiştir",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const PANELIM: Record<string, { href: string; ad: string }> = {
  AGENT: { href: "/komisyoncu", ad: "Komisyoncu Paneli" },
  CLEANER: { href: "/panel", ad: "İşletme Paneli" },
  DRIVER: { href: "/sofor", ad: "Şoför Ekranı" },
  ADMIN: { href: "/admin", ad: "Yönetim" },
  SUPPORT: { href: "/admin", ad: "Yönetim" },
  ACCOUNTANT: { href: "/muhasebe", ad: "Muhasebe" },
  CUSTOMER: { href: "/", ad: "Ana Sayfa" },
};

const inp =
  "w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand focus:outline-none";

export default async function SifrePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const { ok, hata } = await searchParams;
  const u = await getSessionUser();
  if (!u) redirect("/giris");
  const panel = PANELIM[u.role] ?? PANELIM.CUSTOMER;

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Şifremi Değiştir
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {u.name} — değişiklik hemen geçerli olur; bu tarayıcıdaki oturumun
          açık kalır, mobil uygulama kullanıyorsan orada yeniden giriş yapman
          gerekir.
        </p>
      </div>

      {ok && (
        <p
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Şifren değiştirildi ✓ Yeni şifreni kimseyle paylaşma.
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
        action={changeOwnPassword}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Mevcut şifren
          </label>
          <input
            name="eski"
            type="password"
            required
            autoComplete="current-password"
            className={inp}
          />
        </div>
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
          Şifremi Değiştir
        </PendingButton>
      </form>

      <Link
        href={panel.href}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline hover:text-slate-900"
      >
        ← Geri dön: {panel.ad}
      </Link>
    </div>
  );
}
