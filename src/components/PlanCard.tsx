import Link from "next/link";
import { IconCheck } from "@/components/icons";
import { PLAN } from "@/lib/plan";

/**
 * Fiyatlandırma kartı — tek pakete tek kart. İki düzen:
 *  - dar (varsayılan): ana sayfadaki CTA sütununda, tek kolon.
 *  - wide: /kayit ve /abonelik hero'sunda ekranı dolduran iki kolon
 *    (solda marka + fiyat + CTA, sağda faydalar). İçerik src/lib/plan.ts'ten.
 */
export default function PlanCard({
  ctaHref,
  onCta,
  ctaLabel = "Hemen Başla",
  wide = false,
}: {
  /** Link olarak davran (ana sayfa, /abonelik) */
  ctaHref?: string;
  /** Buton olarak davran (/kayit: tıklayınca form açılır) */
  onCta?: () => void;
  ctaLabel?: string;
  /** Geniş, ekranı dolduran iki kolonlu düzen */
  wide?: boolean;
}) {
  const ctaCls =
    "block w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99]";
  const Cta = onCta ? (
    <button type="button" onClick={onCta} className={ctaCls}>
      {ctaLabel}
    </button>
  ) : (
    <Link href={ctaHref ?? "/kayit"} className={ctaCls}>
      {ctaLabel}
    </Link>
  );

  const Price = (
    <p>
      <span className="text-5xl font-extrabold tracking-tight text-slate-900">
        ₺{PLAN.priceAmount}
      </span>
      <span className="text-sm font-medium text-slate-500"> + KDV / ay</span>
    </p>
  );

  const Features = (
    <ul className={wide ? "grid gap-x-6 gap-y-3 sm:grid-cols-2" : "space-y-2.5"}>
      {PLAN.features.map((f) => (
        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
          <span className="mt-0.5 shrink-0 text-brand-bright">
            <IconCheck size={15} />
          </span>
          {f}
        </li>
      ))}
    </ul>
  );

  if (wide) {
    return (
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Sol: marka + fiyat + CTA (renkli panel, dikkat çeker) */}
        <div className="flex flex-col justify-center gap-4 bg-gradient-to-br from-brand to-brand-dark p-8 text-white">
          <div>
            <h2 className="text-xl font-bold">{PLAN.name}</h2>
            <p className="mt-1 text-sm text-teal-50">
              Tek paket, gizli ücret yok.
            </p>
          </div>
          <p>
            <span className="text-5xl font-extrabold tracking-tight">
              ₺{PLAN.priceAmount}
            </span>
            <span className="text-sm font-medium text-teal-50"> + KDV / ay</span>
          </p>
          {onCta ? (
            <button
              type="button"
              onClick={onCta}
              className="block w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-brand-dark transition hover:bg-teal-50 active:scale-[0.99]"
            >
              {ctaLabel}
            </button>
          ) : (
            <Link
              href={ctaHref ?? "/kayit"}
              className="block w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-brand-dark transition hover:bg-teal-50 active:scale-[0.99]"
            >
              {ctaLabel}
            </Link>
          )}
        </div>
        {/* Sağ: faydalar (ekranı doldurur) */}
        <div className="p-8">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pakete dahil olan her şey
          </h3>
          {Features}
        </div>
      </section>
    );
  }

  return (
    <section className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{PLAN.name}</h2>
      <div className="mt-2">{Price}</div>
      <div className="mt-5">{Features}</div>
      <div className="mt-6">{Cta}</div>
    </section>
  );
}
