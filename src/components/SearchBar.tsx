"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconMapPin, IconFilter, IconX } from "@/components/icons";

const DISTRICTS = ["Kadıköy", "Üsküdar", "Beşiktaş", "Şişli"];

type Props = {
  q?: string;
  district?: string;
  lat?: string;
  lng?: string;
  sort?: string;
  maxPrice?: string;
  minRating?: string;
  openNow?: string;
  view?: string;
};

export function SearchBar(p: Props) {
  const router = useRouter();
  const [q, setQ] = useState(p.q ?? "");
  const [maxPrice, setMaxPrice] = useState(p.maxPrice ?? "");
  const [minRating, setMinRating] = useState(p.minRating ?? "");
  const [sort, setSort] = useState(p.sort ?? "nearest");
  const [openNow, setOpenNow] = useState(p.openNow === "1");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  function nav(over: Record<string, string | undefined>) {
    const base: Record<string, string | undefined> = {
      q: p.q,
      district: p.district,
      lat: p.lat,
      lng: p.lng,
      sort: p.sort,
      maxPrice: p.maxPrice,
      minRating: p.minRating,
      openNow: p.openNow,
      view: p.view,
    };
    const merged = { ...base, ...over };
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v != null && v !== "") usp.set(k, String(v));
    }
    router.push(`/?${usp.toString()}`);
  }

  async function searchManual(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      nav({
        lat: String(d.lat),
        lng: String(d.lng),
        q: term,
        district: undefined,
        view: "map",
      });
    } catch {
      setErr("Konum bulunamadı. Aşağıdan semt seçmeyi deneyin.");
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    setErr(null);
    if (!("geolocation" in navigator)) {
      setErr("Tarayıcı konum servisini desteklemiyor. Adres yazıp arayın.");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setErr(
        "Konum için güvenli bağlantı gerekir (https ya da localhost). Telefonda http ile açtıysan adres yazıp arayabilirsin.",
      );
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        nav({
          lat: String(pos.coords.latitude),
          lng: String(pos.coords.longitude),
          q: undefined,
          district: undefined,
          view: "map",
        }),
      (e) => {
        setLoading(false);
        const msg =
          e.code === 1
            ? "Konum izni reddedildi. Tarayıcı/site ayarlarından izin ver."
            : e.code === 2
              ? "Konum alınamadı (sinyal yok)."
              : e.code === 3
                ? "Konum zaman aşımına uğradı, tekrar dene."
                : "Konum alınamadı. Adres yazıp arayabilirsin.";
        setErr(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function applyFilters() {
    nav({
      sort,
      maxPrice: maxPrice || undefined,
      minRating: minRating || undefined,
      openNow: openNow ? "1" : undefined,
    });
  }

  const active =
    p.q ||
    p.district ||
    p.maxPrice ||
    p.minRating ||
    p.openNow ||
    (p.sort && p.sort !== "nearest");
  const view = p.view === "map" ? "map" : "list";
  const inp =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <form onSubmit={searchManual} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Adres veya semt yaz (ör. Kadıköy, Bağdat Cad.)"
          className={`w-full ${inp}`}
        />
        <button
          disabled={loading}
          className="whitespace-nowrap rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          Ara
        </button>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={useMyLocation}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:border-brand hover:text-brand-dark"
        >
          <IconMapPin size={14} /> Konumumu kullan
        </button>
        {DISTRICTS.map((d) => (
          <button
            key={d}
            onClick={() =>
              nav({ district: d, lat: undefined, lng: undefined, q: undefined })
            }
            className={`rounded-full border px-3 py-1 text-sm ${
              p.district === d
                ? "border-brand bg-brand-light text-brand-dark"
                : "border-slate-200 text-slate-600 hover:border-brand"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Filtre + görünüm satırı */}
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700"
        >
          <IconFilter size={14} /> Filtreler
        </button>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300 text-sm">
          <button
            onClick={() => nav({ view: "list" })}
            className={`px-3 py-1 ${view === "list" ? "bg-brand text-white" : "text-slate-600"}`}
          >
            Liste
          </button>
          <button
            onClick={() => nav({ view: "map" })}
            className={`px-3 py-1 ${view === "map" ? "bg-brand text-white" : "text-slate-600"}`}
          >
            Harita
          </button>
        </div>
        {active && (
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-slate-400 hover:text-red-500"
          >
            <IconX size={14} /> Temizle
          </Link>
        )}
      </div>

      {showFilters && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
          <label className="text-xs text-slate-500">
            Sırala
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={`mt-1 w-full ${inp}`}
            >
              <option value="nearest">En yakın</option>
              <option value="rating">Puana göre</option>
              <option value="fastest">En hızlı teslim</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Maks. fiyat (TL/m²)
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="örn. 60"
              className={`mt-1 w-full ${inp}`}
            />
          </label>
          <label className="text-xs text-slate-500">
            Min. puan
            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className={`mt-1 w-full ${inp}`}
            >
              <option value="">Hepsi</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={openNow}
              onChange={(e) => setOpenNow(e.target.checked)}
            />
            Şu an açık
          </label>
          <button
            onClick={applyFilters}
            className="col-span-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
          >
            Filtreleri uygula
          </button>
        </div>
      )}

      {loading && <p className="mt-2 text-sm text-slate-400">Konum aranıyor…</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}
