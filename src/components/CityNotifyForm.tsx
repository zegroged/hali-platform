"use client";
import { useState } from "react";

/**
 * Boş şehir/ilçe sayfasında "açılınca haber ver" e-posta kaydı — ziyaretçi
 * kaybolmasın: şehir açılınca hazır müşteri listesi + talep verisi (/admin).
 */
export default function CityNotifyForm({
  city,
  district,
}: {
  city: string;
  district?: string;
}) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/city-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, district, email, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (data as { error?: string }).error ?? "Kaydedilemedi, tekrar dene.",
        );
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError("Bağlantı hatası — tekrar dene.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="mx-auto mt-4 max-w-md rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Kaydını aldık. {district ?? city} bölgesinde hizmet açıldığında sana
        e-posta ile haber vereceğiz.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-4 max-w-md">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-posta adresin"
          maxLength={120}
          className="w-full flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand"
        />
        {/* Honeypot — insanlar görmez */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="hidden"
        />
        <button
          disabled={state === "busy"}
          className="shrink-0 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
        >
          {state === "busy" ? "Kaydediliyor…" : "Haber ver"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      <p className="mt-1.5 text-xs text-slate-500">
        E-postan yalnız bölgende hizmet açıldığını bildirmek için kullanılır,
        üçüncü kişilerle paylaşılmaz.
      </p>
    </form>
  );
}
