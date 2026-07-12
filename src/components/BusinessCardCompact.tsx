import Link from "next/link";
import { IconTruck, Logo } from "@/components/icons";
import { RatingPill } from "@/components/RatingPill";
import type { BusinessSummary } from "@/lib/businesses";

export function BusinessCardCompact({ b }: { b: BusinessSummary }) {
  const dist =
    b.distanceKm != null
      ? b.distanceKm < 1
        ? `${Math.round(b.distanceKm * 1000)} m`
        : `${b.distanceKm.toFixed(1)} km`
      : null;

  return (
    <Link
      href={`/halici/${b.id}`}
      className="block w-44 shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand hover:shadow-md active:scale-[0.98]"
    >
      {/* Kapak oranı BusinessCard ile aynı (16/10) — listeler arası tutarlılık */}
      <div className="mb-2 aspect-[16/10] overflow-hidden rounded-lg bg-brand-light">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.coverUrl}
            alt={b.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center opacity-60">
            <Logo size={36} />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-1">
        <RatingPill ratingAvg={b.ratingAvg} ratingCount={b.ratingCount} />
        {/* Tatil modunda "Açık" ile çelişmesin — tek rozet */}
        {b.isPaused ? (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
            Sipariş almıyor
          </span>
        ) : (
          <span
            className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-xs font-medium ${
              b.isOpenNow
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {b.isOpenNow ? "Açık" : "Kapalı"}
          </span>
        )}
      </div>
      <h3 className="mt-1 truncate text-sm font-medium text-slate-900">
        {b.name}
      </h3>
      <p className="truncate text-xs text-slate-500">
        {b.district}
        {dist ? ` · ${dist}` : ""}
      </p>
      {b.deliveryMinDays != null && b.deliveryMaxDays != null && (
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
          <IconTruck size={12} />
          {b.deliveryMinDays}-{b.deliveryMaxDays} iş günü
        </p>
      )}
      {b.minPrice != null && (
        <p className="mt-1 text-sm font-semibold text-slate-900">
          {b.minPrice} TL/m²&apos;den
        </p>
      )}
    </Link>
  );
}
