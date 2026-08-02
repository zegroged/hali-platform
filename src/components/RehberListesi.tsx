import Link from "next/link";
import type { Rehber } from "@/lib/rehberler";

// Rehber kartları — hem komisyoncu panelinde hem /komisyoncu/rehberler
// sayfasında aynı bileşen kullanılır (iki yerde ayrı liste tutmayalım).
//
// Listeyi ÇAĞIRAN süzer (rehberleriListele) — bu bileşen yetki bilmez,
// yalnız verilen rehberleri çizer.
export default function RehberListesi({
  rehberler,
  basKomisyoncu,
}: {
  rehberler: Rehber[];
  basKomisyoncu: boolean;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {rehberler.map((r) => (
        <li
          key={r.slug}
          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-lg leading-none" aria-hidden>
              {r.ikon}
            </span>
            <span className="font-semibold text-slate-900">{r.baslik}</span>
            {r.yalnizBas && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                Yalnız sana açık
              </span>
            )}
            {basKomisyoncu && r.ekibeVerilir && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Ekibine ver
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">{r.ozet}</p>
          {/* Telefonda tek elle basılıyor → dokunma hedefi ≥44px (py-3). */}
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/komisyoncu/rehberler/${r.slug}`}
              className="rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Oku
            </Link>
            {/* İndirme sunucudan gelir: Content-Disposition ile .html olarak
                kaydedilir, çift tıklayınca tarayıcıda açılır (çevrimdışı da). */}
            <a
              href={`/komisyoncu/rehberler/${r.slug}/indir`}
              download
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ⬇ HTML indir
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
