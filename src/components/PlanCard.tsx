import Link from "next/link";
import { IconCheck } from "@/components/icons";
import { PLAN } from "@/lib/plan";

/**
 * Fiyatlandırma kartı — tek pakete tek kart (rozet + büyük fiyat + tikli
 * faydalar + tam genişlik CTA). /kayit, /abonelik ve ana sayfada kullanılır;
 * içerik src/lib/plan.ts'ten gelir, tek yerden güncellenir.
 */
export default function PlanCard({
  ctaHref,
  onCta,
  ctaLabel = "Hemen Başla",
}: {
  /** Link olarak davran (ana sayfa, /abonelik) */
  ctaHref?: string;
  /** Buton olarak davran (/kayit: tıklayınca form açılır) */
  onCta?: () => void;
  ctaLabel?: string;
}) {
  const ctaCls =
    "mt-6 block w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99]";
  return (
    <section className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{PLAN.name}</h2>
      <p className="mt-2">
        <span className="text-4xl font-extrabold tracking-tight text-slate-900">
          ₺{PLAN.priceAmount}
        </span>
        <span className="text-sm font-medium text-slate-500">
          {" "}
          + KDV / ay
        </span>
      </p>
      <ul className="mt-5 space-y-2.5">
        {PLAN.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
            <span className="mt-0.5 shrink-0 text-brand-bright">
              <IconCheck size={15} />
            </span>
            {f}
          </li>
        ))}
      </ul>
      {onCta ? (
        <button type="button" onClick={onCta} className={ctaCls}>
          {ctaLabel}
        </button>
      ) : (
        <Link href={ctaHref ?? "/kayit"} className={ctaCls}>
          {ctaLabel}
        </Link>
      )}
    </section>
  );
}
