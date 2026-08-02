import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { PendingButton } from "@/components/PendingButton";
import { prisma } from "@/lib/prisma";
import {
  changeOwnPassword,
  sendEmailCode,
  verifyEmailCode,
} from "./actions";

// ŞİFREMİ DEĞİŞTİR — tüm giriş yapmış roller için ORTAK sayfa (2026-08-02).
// Panellerden 🔑 bağlantısıyla gelinir; rol bazlı geri dönüş linki verilir.
export const metadata: Metadata = {
  title: "Hesap Güvenliği",
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
  searchParams: Promise<{ ok?: string; hata?: string; bekleyen?: string }>;
}) {
  const { ok, hata, bekleyen } = await searchParams;
  const u = await getSessionUser();
  if (!u) redirect("/giris");
  // E-POSTA (2026-08-02): "şifremi unuttum" akışının çalışması için hesapta
  // DOĞRULANMIŞ bir adres gerekir; komisyoncu hesapları e-postasız açılıyordu.
  const hesap = await prisma.user.findUnique({
    where: { id: u.id },
    select: { email: true, emailVerified: true },
  });
  const panel = PANELIM[u.role] ?? PANELIM.CUSTOMER;

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Hesap Güvenliği
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

      {/* E-POSTA KARTI — şifre kurtarmanın ön şartı. */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">E-posta Adresim</h2>
        {hesap?.email && hesap.emailVerified ? (
          <>
            <p className="text-sm text-slate-700">
              Kayıtlı ve doğrulanmış: <strong>{hesap.email}</strong> ✓
            </p>
            <p className="text-xs text-slate-500">
              Şifreni unutursan giriş sayfasındaki{" "}
              <strong>&quot;Şifremi unuttum&quot;</strong> ile bu adresten
              yenileyebilirsin. Değiştirmek istersen aşağıya yeni adresi yaz.
            </p>
          </>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <strong>Hesabında doğrulanmış e-posta yok.</strong> Şifreni
            unutursan kendi kendine yenileyemezsin — yöneticiyi aramak zorunda
            kalırsın. Aşağıdan ekle, 1 dakika sürer.
          </p>
        )}

        {bekleyen ? (
          <form action={verifyEmailCode} className="space-y-3">
            <input type="hidden" name="eposta" value={bekleyen} />
            <p className="text-sm text-slate-700">
              <strong>{bekleyen}</strong> adresine gönderdiğimiz 6 haneli kodu
              yaz (10 dakika geçerli):
            </p>
            <input
              name="kod"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="123456"
              className={inp}
            />
            <PendingButton className="w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand-dark">
              Kodu Doğrula
            </PendingButton>
          </form>
        ) : (
          <form action={sendEmailCode} className="space-y-3">
            <input
              name="eposta"
              type="email"
              required
              placeholder="ornek@eposta.com"
              autoComplete="email"
              className={inp}
            />
            <PendingButton className="w-full rounded-lg border border-brand px-4 py-3 text-base font-semibold text-brand hover:bg-brand/5">
              {hesap?.email ? "E-postamı Değiştir" : "E-posta Ekle ve Doğrula"}
            </PendingButton>
          </form>
        )}
      </section>

      <Link
        href={panel.href}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline hover:text-slate-900"
      >
        ← Geri dön: {panel.ad}
      </Link>
    </div>
  );
}
