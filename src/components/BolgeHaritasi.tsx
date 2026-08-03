"use client";

import { useMemo, useState } from "react";
import type { IlOzeti, IlceSatiri } from "@/lib/territory";

// BÖLGE HARİTASI (2026-07-28) — "kim nerede çalışıyor, neresi boşta".
//
// Admin ve baş komisyoncu ülke genelini görür; alt komisyoncu YALNIZ kendi
// ilini (sayfa tarafında filtrelenir, buraya zaten tek il gelir).
//
// 973 ilçeyi tek listede basmak okunmaz olurdu: il satırları açılıp kapanıyor,
// arama kutusu il/ilçe adında süzüyor, "sadece boş bölgeler" filtresi var —
// çünkü asıl aranan bilgi genelde "nereye komisyoncu koyabilirim".

type Props = {
  iller: IlOzeti[];
  ilceler: Record<string, IlceSatiri>; // "İl|İlçe"
  ilceAdlari: Record<string, string[]>; // il → ilçe adları
  /** Tek il kipi: alt komisyoncuya yalnız kendi ili gösterilir. */
  tekIl?: string;
};

export default function BolgeHaritasi({
  iller,
  ilceler,
  ilceAdlari,
  tekIl,
}: Props) {
  const [arama, setArama] = useState("");
  const [yalnizBos, setYalnizBos] = useState(false);
  const [acik, setAcik] = useState<string | null>(tekIl ?? null);

  const q = arama.trim().toLocaleLowerCase("tr");

  const gorunen = useMemo(() => {
    let liste = tekIl ? iller.filter((i) => i.city === tekIl) : iller;
    if (q) {
      liste = liste.filter((i) => {
        if (i.city.toLocaleLowerCase("tr").includes(q)) return true;
        // İlçe adında da ara — "şehitkamil" yazınca Gaziantep çıksın.
        return (ilceAdlari[i.city] ?? []).some((d) =>
          d.toLocaleLowerCase("tr").includes(q),
        );
      });
    }
    if (yalnizBos) liste = liste.filter((i) => i.komisyoncu === 0);
    return liste;
  }, [iller, ilceAdlari, q, yalnizBos, tekIl]);

  const toplam = useMemo(() => {
    const k = iller.reduce((a, i) => a + i.komisyoncu, 0);
    const b = iller.reduce((a, i) => a + i.isletme, 0);
    const bosIl = iller.filter((i) => i.komisyoncu === 0).length;
    return { k, b, bosIl };
  }, [iller]);

  const satir = (r: IlceSatiri) => (
    <div
      key={r.district}
      className="flex items-center justify-between border-b border-slate-50 px-3 py-2 text-sm last:border-0"
    >
      <span className="text-slate-700">{r.district}</span>
      <span className="flex items-center gap-3">
        <span
          className={
            r.komisyoncu > 0
              ? "rounded-full bg-brand-light px-2 py-0.5 text-xs font-medium text-brand-dark"
              : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
          }
        >
          {r.komisyoncu > 0 ? `${r.komisyoncu} komisyoncu` : "boşta"}
        </span>
        <span className="w-24 text-right text-xs text-slate-500">
          {r.isletme > 0 ? `${r.isletme} işletme` : "—"}
        </span>
      </span>
    </div>
  );

  return (
    <div className="space-y-3">
      {!tekIl && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Bölgesi tanımlı komisyoncu</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">{toplam.k}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Kayıtlı işletme</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">{toplam.b}</p>
            </div>
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs text-amber-800">Komisyoncusuz il</p>
              <p className="mt-0.5 text-xl font-bold text-amber-900">
                {toplam.bosIl}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="İl ya da ilçe ara — ör. Gaziantep, Şehitkamil"
              className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setYalnizBos((v) => !v)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                yalnizBos
                  ? "border-amber-400 bg-amber-50 font-medium text-amber-800"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Yalnız boş iller
            </button>
          </div>
        </>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {gorunen.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            Eşleşen il bulunamadı.
          </p>
        )}
        {gorunen.map((il) => {
          const ilceListesi = (ilceAdlari[il.city] ?? []).map(
            (d) =>
              ilceler[`${il.city}|${d}`] ?? {
                city: il.city,
                district: d,
                komisyoncu: 0,
                isletme: 0,
              },
          );
          // Aramada ilçe yazıldıysa yalnız eşleşen ilçeleri göster.
          const gosterilecek =
            q && !il.city.toLocaleLowerCase("tr").includes(q)
              ? ilceListesi.filter((r) =>
                  r.district.toLocaleLowerCase("tr").includes(q),
                )
              : ilceListesi;
          const acikMi = acik === il.city || Boolean(tekIl) || Boolean(q);
          return (
            <div key={il.city} className="border-b border-slate-100 last:border-0">
              <button
                type="button"
                onClick={() => setAcik(acik === il.city ? null : il.city)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className="text-slate-400">
                    {acikMi ? "▾" : "▸"}
                  </span>
                  <span className="font-medium text-slate-900">{il.city}</span>
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      il.komisyoncu > 0
                        ? "rounded-full bg-brand-light px-2 py-0.5 font-medium text-brand-dark"
                        : "rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800"
                    }
                  >
                    {il.komisyoncu > 0
                      ? `${il.komisyoncu} komisyoncu`
                      : "komisyoncu yok"}
                  </span>
                  <span className="text-slate-500">{il.isletme} işletme</span>
                  <span className="hidden text-slate-400 sm:inline">
                    {il.dolulIlce}/{il.ilceSayisi} ilçe dolu
                  </span>
                </span>
              </button>
              {acikMi && (
                <div className="bg-slate-50/60">
                  {gosterilecek.map(satir)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
