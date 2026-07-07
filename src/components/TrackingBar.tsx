"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPackage } from "@/components/icons";

/**
 * Ana sayfada belirgin sipariş takip kutusu — mobilde header'daki küçük ikon
 * yeterince görünmüyordu; müşteri halısını nereden izleyeceğini bilsin diye
 * kod girişini doğrudan öne çıkarır. /takip sayfasıyla aynı akış.
 */
export default function TrackingBar() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length < 6) return;
    router.push(`/takip/${encodeURIComponent(c)}`);
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 text-brand-dark">
        <IconPackage size={18} />
        <h2 className="text-sm font-semibold text-slate-900">
          Siparişini takip et
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Halıcının verdiği 6 haneli kodu gir, halının hangi aşamada olduğunu
        anlık gör.
      </p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label htmlFor="anasayfa-takip-kodu" className="sr-only">
          Takip kodu
        </label>
        <input
          id="anasayfa-takip-kodu"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="HLK4F2"
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center font-mono text-lg uppercase tracking-[0.3em] focus:border-brand"
        />
        <button
          disabled={code.trim().length < 6}
          className="whitespace-nowrap rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Takip Et
        </button>
      </form>
    </section>
  );
}
