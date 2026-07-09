"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { IconX } from "@/components/icons";

const PickMap = dynamic(() => import("@/components/PickMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
      Harita yükleniyor…
    </div>
  ),
});

export type Coords = { lat: number; lng: number };

/**
 * Müşteri konumu seçici (halıcı paneli): adresten bul, haritaya tıkla, ya da
 * koordinatı elle yaz. Opsiyoneldir — konum yoksa şoför yalnız adrese gider.
 */
export function LocationPicker({
  value,
  onChange,
  addressHint,
}: {
  value: Coords | null;
  onChange: (c: Coords | null) => void;
  /** Adres alanındaki metin — "Adresten bul" bunu kullanır. */
  addressHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function findFromAddress() {
    const q = (addressHint ?? "").trim();
    if (q.length < 3) {
      setMsg("Önce adresi yaz, sonra 'Adresten bul'a bas.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/geocode?q=" + encodeURIComponent(q));
      if (!res.ok) {
        setMsg(
          res.status === 404
            ? "Adres haritada bulunamadı — haritadan elle işaretle."
            : "Adres araması başarısız, haritadan elle işaretle.",
        );
        return;
      }
      const d = (await res.json()) as Coords;
      onChange({ lat: d.lat, lng: d.lng });
      setOpen(true);
      setMsg("Bulundu — yanlışsa haritaya tıklayıp düzeltebilirsin.");
    } catch {
      setMsg("Bağlantı hatası. Haritadan elle işaretle.");
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={findFromAddress} disabled={busy} className={btn}>
          {busy ? "Aranıyor…" : "Adresten bul"}
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} className={btn}>
          {open ? "Haritayı gizle" : "Haritadan seç"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setMsg(null);
            }}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <IconX size={14} /> Konumu kaldır
          </button>
        )}
      </div>

      {value ? (
        <p className="mt-2 text-xs text-emerald-700">
          ✓ Konum seçildi:{" "}
          <span className="font-mono">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Konum opsiyonel. Eklersen şoför adresi haritada tam noktada görür.
        </p>
      )}
      {msg && <p className="mt-1 text-xs text-slate-600">{msg}</p>}

      {open && (
        <div className="mt-3">
          <PickMap value={value} onPick={onChange} />
          <p className="mt-1 text-xs text-slate-500">
            Haritaya tıklayarak müşterinin kapısını işaretle.
          </p>
        </div>
      )}
    </div>
  );
}
