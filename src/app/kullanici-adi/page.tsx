import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PendingButton } from "@/components/PendingButton";
import { setMyUsername } from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ROLE_HOME: Record<string, string> = {
  CLEANER: "/panel",
  DRIVER: "/sofor",
  ADMIN: "/admin",
  SUPPORT: "/destek",
  CUSTOMER: "/",
};

// Telefonla giriş kaldırıldı. Kullanıcı adı olmayan eski hesaplar (e-postasıyla
// giriş yapabilenler) ilk girişte buraya yönlendirilir ve kimliğini tamamlar.
export default async function KullaniciAdiPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const u = await getSessionUser();
  if (!u) redirect("/giris");
  if (u.username) redirect(ROLE_HOME[u.role] ?? "/");
  const { hata } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-10">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        Kullanıcı adını belirle
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Telefonla giriş kaldırıldı. Bundan sonra e-postan veya buraya
        yazacağın kullanıcı adıyla gireceksin. Bu adım bir kez yapılır.
      </p>

      {hata && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {hata}
        </p>
      )}

      <form action={setMyUsername} className="mt-6 space-y-3">
        <div>
          <label
            htmlFor="kullanici-adi"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Kullanıcı adı
          </label>
          <input
            id="kullanici-adi"
            name="username"
            type="text"
            required
            minLength={3}
            maxLength={30}
            placeholder="orn: mehmet.hali"
            autoComplete="username"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand"
          />
          <p className="mt-1 text-xs text-slate-500">
            En az 3 karakter. Harf, rakam ve . _ - kullanılabilir; büyük/küçük
            harf farketmez.
          </p>
        </div>
        <PendingButton className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60">
          Kaydet ve devam et
        </PendingButton>
      </form>
    </main>
  );
}
