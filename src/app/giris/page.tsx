"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ROLE_HOME: Record<string, string> = {
  CLEANER: "/panel",
  DRIVER: "/sofor",
  ADMIN: "/admin",
  CUSTOMER: "/",
};

export default function GirisPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Telefon veya şifre hatalı.");
      return;
    }
    const data = await res.json();
    router.push(ROLE_HOME[data.role] ?? "/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-sm text-brand-dark hover:underline">
        ← Ana sayfa
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Giriş Yap</h1>
      <p className="mt-1 text-sm text-slate-500">
        Halıcı, şoför veya admin hesabınızla girin.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefon (05xx...)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          autoComplete="username"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Şifre"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          autoComplete="current-password"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>

      {process.env.NODE_ENV !== "production" && (
        <div className="mt-6 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
          <p className="font-semibold">Demo hesaplar (şifre: 1234) — yalnız geliştirme</p>
          <p>Halıcı: 05321112201 · Şoför: 05331112202 · Admin: 05320000000</p>
        </div>
      )}
    </main>
  );
}
