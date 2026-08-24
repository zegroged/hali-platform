"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconMapPin, IconFilter, IconX } from "@/components/icons";
import { resolveSearchLocation } from "@/lib/cities";

type Props = {
  q?: string;
  il?: string;
  district?: string;
  lat?: string;
  lng?: string;
  sort?: string;
  maxPrice?: string;
  minRating?: string;
  openNow?: string;
  view?: string;
  /** Toplam işletme sayısı — 0 iken arama pasifleşir (lansman/boş DB dönemi). */
  totalCount?: number;
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
      il: p.il,
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
    // Önce il/ilçe listesiyle eşleştir: "kars" → Kars ilindeki TÜM halıcılar
    // (metni koordinata çevirip "en yakın 940 km" saçmalığına düşme).
    const loc = resolveSearchLocation(term);
    if (loc) {
      nav({
        il: loc.city,
        district: loc.district,
        lat: undefined,
        lng: undefined,
        q: undefined,
        view: undefined,
      });
      return;
    }
    // Listeyle eşleşmedi (cadde/mahalle/adres) → koordinata çevirip yakınlık
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      nav({
        lat: String(d.lat),
        lng: String(d.lng),
        q: term,
        il: undefined,
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
          // Koordinatı ~3 ondalığa (~100m) yuvarla: yakınlık sıralaması için
          // yeterli, tam GPS'i tarayıcı geçmişine/Referer'a sızdırma (gizlilik).
          lat: pos.coords.latitude.toFixed(3),
          lng: pos.coords.longitude.toFixed(3),
          q: undefined,
          il: undefined,
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
    p.il ||
    p.district ||
    p.maxPrice ||
    p.minRating ||
    p.openNow ||
    (p.sort && p.sort !== "nearest");
  const view = p.view === "map" ? "map" : "list";
  // Boş DB (lansman) döneminde arama pasif: her etkileşim "bulunamadı"ya çıkmasın.
  const idle = p.totalCount === 0;
  const inp =
    "rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-brand disabled:bg-slate-50 sm:text-sm";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      {/* Birincil yol: tek dokunuşla en yakın halıcılar */}
      <button
        onClick={useMyLocation}
        disabled={loading || idle}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
      >
        <IconMapPin size={16} /> Konumumu kullan
      </button>

      <div className="mt-3 flex items-center gap-2" aria-hidden>
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-500">veya adres yaz</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {/* İkincil yol: adres/semt yazarak arama */}
      <form onSubmit={searchManual} className="mt-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="İl, ilçe veya adres yaz (ör. Konya, Kadıköy)"
          aria-label="İl, ilçe veya adres ara"
          disabled={idle}
          className={`w-full ${inp}`}
        />
        <button
          disabled={loading || idle}
          className="whitespace-nowrap rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Ara
        </button>
      </form>

      {idle ? (
        <p className="mt-2.5 text-sm text-slate-600">
          Arama çok yakında aktif — bölgendeki halıcılar şu anda ekleniyor.
        </p>
      ) : null}
      {/* 🔴 ŞEHİR KISAYOLLARI KALDIRILDI (2026-08-11, işletme sahibi isteği).
          Arama kutusunun HEMEN ALTINDA, yayında işletmesi olan illerin
          düğmeleri duruyordu (Gaziantep · Konya · Batman · Adana). Kaldırıldı.
          NOT: sayfanın alt kısmındaki "Şehrinde halı yıkama servisi" bölümü
          (app/page.tsx CityShortcuts) AYRI bir şeydir ve DURUYOR — SEO iç
          linklemesi oradan geliyor. */}

      {/* Filtre + görünüm satırı: yalnız aktif bir sorgu varken görünür */}
      {active && !idle && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <IconFilter size={14} /> Filtreler
          </button>
          <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300 text-sm">
            <button
              onClick={() => nav({ view: "list" })}
              className={`px-3 py-2 ${view === "list" ? "bg-brand font-medium text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Liste
            </button>
            <button
              onClick={() => nav({ view: "map" })}
              className={`px-3 py-2 ${view === "map" ? "bg-brand font-medium text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Harita
            </button>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full px-2 py-2 text-sm text-slate-500 hover:text-red-500"
          >
            <IconX size={14} /> Temizle
          </Link>
        </div>
      )}

      {active && !idle && showFilters && (
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
          <label className="flex items-center gap-2 py-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={openNow}
              onChange={(e) => setOpenNow(e.target.checked)}
              className="h-5 w-5 accent-brand"
            />
            Şu an açık
          </label>
          <button
            onClick={applyFilters}
            className="col-span-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Filtreleri uygula
          </button>
        </div>
      )}

      {loading && <p className="mt-2 text-sm text-slate-500">Konum aranıyor…</p>}
      {err && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {err}
        </p>
      )}
    </div>
  );
}
