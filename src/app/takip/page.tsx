"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";
import { IconPackage } from "@/components/icons";

export default function TakipIndex() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length < 6) return;
    router.push(`/takip/${encodeURIComponent(c)}`);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-sm flex-1 px-6 py-16">
        <Link href="/" className="text-sm text-brand-dark hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-6 inline-flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          <IconPackage size={24} /> Sipariş Takibi
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Halıcının verdiği 6 haneli takip kodunu gir.
        </p>
        <form onSubmit={submit} className="mt-6 flex gap-2">
          <label htmlFor="takip-kodu" className="sr-only">
            Takip kodu
          </label>
          <input
            id="takip-kodu"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="HLK4F2"
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-xl uppercase tracking-[0.4em] focus:border-brand"
          />
          <button
            disabled={code.trim().length < 6}
            className="whitespace-nowrap rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Takip Et
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Kod 6 haneli — halıcından aldığın SMS/mesajda yazıyor.
        </p>
      </main>
      <Footer />
    </div>
  );
}
