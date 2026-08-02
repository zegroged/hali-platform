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
  ACCOUNTANT: "/muhasebe",
  AGENT: "/komisyoncu",
  CUSTOMER: "/hesabim",
};

/** Alan bazlı doğrulama hataları (alan adı → mesaj). */
type FieldErrors = Partial<Record<"identifier" | "password", string>>;

export default function GirisPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Giriş kimliği: DOĞRULANMIŞ e-posta veya kullanıcı adı. Telefon kabul
    // edilmez (SMS doğrulaması olmadığından sahiplik kanıtlanamıyor).
    const id = identifier.trim();
    const errs: FieldErrors = {};
    if (id.length < 3) {
      errs.identifier = "E-posta veya kullanıcı adı gir.";
    } else if (
      // Eski alışkanlıkla telefon yazanı boş bir "hatalı" mesajıyla bırakma.
      // Yalnız GERÇEKTEN telefona benzeyeni reddet: harf yok + en az 10 rakam.
      // ("3.14" gibi geçerli kullanıcı adları yanlışlıkla engellenmesin.)
      !/[a-zçğıöşü_]/i.test(id) &&
      id.replace(/\D/g, "").length >= 10
    ) {
      errs.identifier =
        "Telefonla giriş kaldırıldı. E-postanı veya kullanıcı adını gir.";
    }
    if (!password) errs.password = "Şifre gerekli.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: id, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        // 403 (engelli hesap / doğrulanmamış e-posta) kendi mesajını taşır.
        setError(
          res.status === 403 && data?.error
            ? data.error
            : "E-posta/kullanıcı adı veya şifre hatalı.",
        );
        return;
      }
      const data = await res.json();
      // Kullanıcı adı yalnız HALICI/ŞOFÖR için gerekli — müşteride (CUSTOMER)
      // kullanıcı adı yoktur, doğrudan hesabına gider.
      const needsUsername =
        data.needsUsername &&
        (data.role === "CLEANER" || data.role === "DRIVER");
      router.push(
        needsUsername ? "/kullanici-adi" : (ROLE_HOME[data.role] ?? "/"),
      );
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
          Giriş Yap
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Müşteri, halıcı veya şoför hesabınla e-postanla giriş yap.
        </p>

        <form onSubmit={submit} noValidate className="mt-6 space-y-3">
          <div>
            <label htmlFor="giris-kimlik" className={labelCls}>
              E-posta veya kullanıcı adı
            </label>
            <input
              id="giris-kimlik"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              type="text"
              maxLength={120}
              placeholder="ornek@eposta.com"
              className={inputCls(fieldErrors.identifier)}
              autoComplete="username"
            />
            {fieldErrors.identifier && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.identifier}
              </p>
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

        <p className="mt-3 text-sm">
          <Link href="/sifremi-unuttum" className="text-brand-dark underline">
            Şifremi unuttum
          </Link>
        </p>

        <p className="mt-3 text-xs text-slate-500">
          Şoförsün ve giriş bilgini bilmiyor musun? Kullanıcı adını çalıştığın
          işletmeden öğrenebilirsin.
        </p>

        <p className="mt-4 text-sm text-slate-500">
          Siparişini mi arıyorsun? Takip koduyla{" "}
          <Link href="/takip" className="text-brand-dark underline">
            takip sayfasını
          </Link>{" "}
          kullan.
        </p>

        {/* Müşteri üyeliği: puan biriktir + yorum yap */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Müşteri misin?
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Ücretsiz üye ol; siparişlerini takip et, hizmetini değerlendir ve
            puan biriktir.
          </p>
          <Link
            href="/uye-ol"
            className="mt-3 inline-flex min-h-[40px] items-center rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-light"
          >
            Üye Ol
          </Link>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            İşletme misin?
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
            <p>Halıcı: halici1 · Şoför: sofor1 · Admin: mert123</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
