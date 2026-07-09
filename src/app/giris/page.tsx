"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";

const ROLE_HOME: Record<string, string> = {
  CLEANER: "/panel",
  DRIVER: "/sofor",
  ADMIN: "/admin",
  SUPPORT: "/destek",
  CUSTOMER: "/",
};

/** Alan bazlı doğrulama hataları (alan adı → mesaj). */
type FieldErrors = Partial<Record<"phone" | "password", string>>;

export default function GirisPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Alan bazlı doğrulama — hatalı alan işaretlenir, mesajı altında gösterilir.
    // Ayraçları (boşluk/tire/parantez/nokta) söküp salt rakam kalıyorsa telefon,
    // kalmıyorsa kullanıcı adı kabul edilir ("0532 111 22 01" telefon sayılır).
    const digits = phone.replace(/[\s().-]/g, "");
    const isPhone = /^\d+$/.test(digits) && digits.length > 0;
    const id = isPhone ? digits : phone.trim();
    const errs: FieldErrors = {};
    if (isPhone) {
      if (id.length < 10)
        errs.phone = "Telefon 05xx ile başlamalı ve 11 hane olmalı.";
    } else if (id.length < 3) {
      errs.phone = "Telefon veya kullanıcı adı gir.";
    }
    if (!password) errs.password = "Şifre gerekli.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: id, password }),
      });
      if (!res.ok) {
        setError("Telefon veya şifre hatalı.");
        return;
      }
      const data = await res.json();
      router.push(ROLE_HOME[data.role] ?? "/");
      router.refresh();
    } catch {
      setError("Bağlantı hatası, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = (bad?: string) =>
    `w-full rounded-lg border px-3 py-2 focus:border-brand ${
      bad ? "border-red-500" : "border-slate-300"
    }`;
  const labelCls = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
        <Link href="/" className="mb-6 text-sm text-brand-dark hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          İşletme Girişi
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Halıcı veya şoför hesabınla giriş yap.
        </p>

        <form onSubmit={submit} noValidate className="mt-6 space-y-3">
          <div>
            <label htmlFor="giris-telefon" className={labelCls}>
              Telefon veya kullanıcı adı
            </label>
            <input
              id="giris-telefon"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="text"
              // Rakam/ayraç yazıldıkça (ve boşken) mobilde numerik klavye kalsın;
              // kullanıcı adı (harf) girilirse tam klavyeye geçer.
              inputMode={/^[\d\s().-]*$/.test(phone) ? "tel" : "text"}
              maxLength={50}
              placeholder="05xxxxxxxxx"
              className={inputCls(fieldErrors.phone)}
              autoComplete="username"
            />
            {fieldErrors.phone && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
            )}
          </div>
          <div>
            <label htmlFor="giris-sifre" className={labelCls}>
              Şifre
            </label>
            <input
              id="giris-sifre"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls(fieldErrors.password)}
              autoComplete="current-password"
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500">
          Siparişini mi arıyorsun? Takip koduyla{" "}
          <Link href="/takip" className="text-brand-dark underline">
            takip sayfasını
          </Link>{" "}
          kullan.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Henüz hesabın yok mu?
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Halı yıkama işletmeni birkaç dakikada kaydet, bölgendeki
            müşterilere ulaş.
          </p>
          <Link
            href="/kayit"
            className="mt-3 inline-flex min-h-[40px] items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            İşletmeni Ekle
          </Link>
          <p className="mt-2 text-xs text-slate-500">
            Soruların mı var?{" "}
            <Link href="/iletisim" className="underline">
              Bize ulaş
            </Link>
          </p>
        </div>

        {process.env.NODE_ENV !== "production" && (
          <div className="mt-6 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
            <p className="font-semibold">
              Demo hesaplar (şifre: 1234) — yalnız geliştirme
            </p>
            <p>Halıcı: 05321112201 · Şoför: 05331112202 · Admin: 05320000000</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
