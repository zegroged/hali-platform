"use client";

import { useRef, useState } from "react";
import { PendingButton } from "@/components/PendingButton";

// HAZIR KALEMLER (2026-07-30): canlıda fiyat girmiş 21 işletmenin 19'unda tek
// kalem vardı — boş forma bakan halıcı "ne yazacağım" diye donup kalıyordu.
// Dokununca etiket + birim kendiliğinden dolar, halıcı yalnız fiyatı yazar.
// Serbest form aynen duruyor: istediğini istediği gibi yazabilir.
const HAZIR = [
  { label: "Makine Halısı", unit: "PER_M2" },
  { label: "Shaggy", unit: "PER_M2" },
  { label: "Yolluk", unit: "PER_M2" },
  { label: "Kilim", unit: "PER_M2" },
  { label: "El Dokuma", unit: "PER_M2" },
] as const;

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand";
const lbl = "text-xs font-medium text-slate-500";

/** Türkçe küçültme — varsayılan toLowerCase "İ"yi bozar, "Makine Halısı" eşleşmezdi. */
const sadeles = (s: string) => s.trim().toLocaleLowerCase("tr");

export function FiyatEkle({
  action,
  mevcutEtiketler,
}: {
  action: (formData: FormData) => void | Promise<void>;
  mevcutEtiketler: string[];
}) {
  const etiketRef = useRef<HTMLInputElement>(null);
  const fiyatRef = useRef<HTMLInputElement>(null);
  const birimRef = useRef<HTMLSelectElement>(null);
  const [uyari, setUyari] = useState<string | null>(null);

  const eklenmis = new Set(mevcutEtiketler.map(sadeles));

  function hazirSec(h: (typeof HAZIR)[number]) {
    // Zaten varsa ekletmiyoruz ama ENGELLEMİYORUZ da: aynı adı gerçekten
    // istiyorsa aşağıdaki serbest forma elle yazabilir.
    if (eklenmis.has(sadeles(h.label))) {
      setUyari(
        `"${h.label}" listende zaten var. Fiyatını değiştirmek için o satırdaki "Düzenle" düğmesine bas.`,
      );
      return;
    }
    setUyari(null);
    if (etiketRef.current) etiketRef.current.value = h.label;
    if (birimRef.current) birimRef.current.value = h.unit;
    fiyatRef.current?.focus();
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-800">Yeni fiyat ekle</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Aşağıdakilerden birine dokun — adı kendiliğinden yazılır, sen sadece
        fiyatı gir. Listede olmayan bir şey için alttaki kutuya kendin yazabilirsin.
      </p>

      {/* Hazır düğmeler */}
      <div className="mt-2 flex flex-wrap gap-2">
        {HAZIR.map((h) => {
          const zaten = eklenmis.has(sadeles(h.label));
          return (
            <button
              key={h.label}
              type="button"
              onClick={() => hazirSec(h)}
              aria-label={
                zaten ? `${h.label} zaten ekli` : `${h.label} ekle`
              }
              className={
                zaten
                  ? "rounded-full border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-400"
                  : "rounded-full border border-brand/40 bg-white px-3.5 py-2.5 text-sm font-medium text-brand transition hover:bg-brand hover:text-white active:scale-[0.98]"
              }
            >
              {zaten ? `✓ ${h.label}` : `+ ${h.label}`}
            </button>
          );
        })}
      </div>

      {uyari && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"
        >
          {uyari}
        </p>
      )}

      {/* Serbest form — hazır düğme dokunuşu buradaki alanları doldurur.
          Mobilde 2 kolonlu katman, sm+ ekranda 12 kolonlu tek satır. */}
      <form
        action={async (fd) => {
          setUyari(null);
          await action(fd);
        }}
        className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-12"
      >
        <div className="col-span-2 sm:col-span-5">
          <label className={lbl} htmlFor="yeni-etiket">
            Ne yıkıyorsun?
          </label>
          <input
            id="yeni-etiket"
            ref={etiketRef}
            name="label"
            placeholder="Ör. Makine Halısı"
            className={inp}
          />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className={lbl} htmlFor="yeni-fiyat">
            Fiyat (TL)
          </label>
          <input
            id="yeni-fiyat"
            ref={fiyatRef}
            name="price"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0"
            className={inp}
          />
        </div>
        <div className="col-span-1 sm:col-span-3">
          <label className={lbl} htmlFor="yeni-birim">
            Nasıl hesaplanır?
          </label>
          <select id="yeni-birim" ref={birimRef} name="unit" className={inp}>
            <option value="PER_M2">metrekare başına</option>
            <option value="PER_PIECE">adet başına</option>
            <option value="FLAT">sabit ücret</option>
          </select>
        </div>
        <label className="col-span-2 flex items-center gap-1.5 self-end pb-2 text-xs text-slate-500 sm:col-span-2">
          <input type="checkbox" name="isAddon" className="h-4 w-4 accent-brand" />{" "}
          ek hizmet
        </label>
        <PendingButton className="col-span-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60 sm:col-span-12">
          Fiyat ekle
        </PendingButton>
      </form>
    </div>
  );
}
