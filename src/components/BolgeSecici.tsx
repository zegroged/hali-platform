"use client";

import { useMemo, useState } from "react";

// KOMİSYONCU BÖLGE SEÇİCİ (2026-07-28).
//
// İl seç → o ilin ilçeleri kutucuk olarak çıkar → birden fazla seçilebilir
// (bir kişi Şehitkamil + Şahinbey alabilir).
//
// ÇAKIŞMA UYARISI: dolu ilçelerde kaç komisyoncu olduğu rozetle görünür ve
// seçilince sarı uyarı çıkar — ama ENGELLEMEZ. Kullanıcı kararı: "10 komisyoncu
// atansa bir işletme bile kayıt olmasa izin verilmemesi bizim için kötü olur."

type Props = {
  ilceAdlari: Record<string, string[]>; // il → ilçeler
  /** "İl|İlçe" → o ilçedeki aktif komisyoncu sayısı */
  doluluk: Record<string, number>;
  /** Baş komisyoncu kendi ilinden başka il seçemesin diye kısıt. */
  sadeceIl?: string;
  zorunlu?: boolean;
};

export default function BolgeSecici({
  ilceAdlari,
  doluluk,
  sadeceIl,
  zorunlu = true,
}: Props) {
  const iller = useMemo(() => Object.keys(ilceAdlari).sort((a, b) => a.localeCompare(b, "tr")), [ilceAdlari]);
  const [il, setIl] = useState(sadeceIl ?? "");
  const [secili, setSecili] = useState<string[]>([]);

  const ilceler = il ? (ilceAdlari[il] ?? []) : [];
  const doluSecilenler = secili.filter((d) => (doluluk[`${il}|${d}`] ?? 0) > 0);

  const degistir = (d: string) =>
    setSecili((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-700">
        Bölge {zorunlu && <span className="text-red-500">*</span>}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        Bu komisyoncu nerelerden sorumlu olacak? Birden fazla ilçe seçebilirsin.
      </p>

      {/* Sunucuya giden değerler */}
      <input type="hidden" name="territoryCity" value={il} />
      {secili.map((d) => (
        <input key={d} type="hidden" name="territoryDistrict" value={d} />
      ))}

      <div className="mt-2">
        <label className="mb-1 block text-xs font-medium text-slate-600">İl</label>
        <select
          value={il}
          onChange={(e) => {
            setIl(e.target.value);
            setSecili([]);
          }}
          disabled={Boolean(sadeceIl)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:bg-slate-100"
        >
          <option value="">Seç…</option>
          {iller.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {sadeceIl && (
          <p className="mt-1 text-xs text-slate-500">
            Kendi ilin dışına komisyoncu atayamazsın.
          </p>
        )}
      </div>

      {il && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">
              İlçeler ({secili.length} seçili)
            </label>
            <button
              type="button"
              onClick={() =>
                setSecili(secili.length === ilceler.length ? [] : [...ilceler])
              }
              className="text-xs text-brand-dark hover:underline"
            >
              {secili.length === ilceler.length ? "Hiçbirini seçme" : "Tümünü seç"}
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
            <div className="grid gap-1 sm:grid-cols-2">
              {ilceler.map((d) => {
                const kac = doluluk[`${il}|${d}`] ?? 0;
                const sec = secili.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => degistir(d)}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                      sec
                        ? "border-brand bg-brand-light font-medium text-brand-dark"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{d}</span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                        kac > 0
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {kac > 0 ? `${kac} kişi` : "boş"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {doluSecilenler.length > 0 && (
            <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Dikkat:</strong> {doluSecilenler.join(", ")} ilçesinde zaten
              komisyoncu var. Yine de atayabilirsin — engellemiyoruz, sadece
              haberin olsun diye söylüyoruz.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
