"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconPackage } from "@/components/icons";

export default function TakipIndex() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) router.push(`/takip/${encodeURIComponent(c)}`);
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <Link href="/" className="text-sm text-brand-dark hover:underline">
        ← Ana sayfa
      </Link>
      <h1 className="mt-6 inline-flex items-center gap-2 text-2xl font-bold text-slate-900">
        <IconPackage size={24} /> Siparişini Takip Et
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Halıcının verdiği takip kodunu gir.
      </p>
      <form onSubmit={submit} className="mt-6 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Takip kodu (ör. HLK4F2)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase tracking-widest focus:border-brand focus:outline-none"
        />
        <button className="whitespace-nowrap rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark">
          Takip Et
        </button>
      </form>
    </main>
  );
}
