import Link from "next/link";
import { Badges } from "@/components/Badges";
import { IconStar, IconTruck, IconClock, Logo } from "@/components/icons";
import type { BusinessSummary } from "@/lib/businesses";

export function BusinessCard({ b }: { b: BusinessSummary }) {
  const dist =
    b.distanceKm != null
      ? b.distanceKm < 1
        ? `${Math.round(b.distanceKm * 1000)} m`
        : `${b.distanceKm.toFixed(1)} km`
      : null;

  return (
    <Link
      href={`/halici/${b.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-brand hover:shadow-md"
    >
      {/* Kapak görseli */}
      <div className="relative aspect-[16/10] overflow-hidden bg-brand-light">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.coverUrl}
            alt={b.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center opacity-60">
            <Logo size={44} />
          </div>
        )}
        <span
          className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur ${
            b.isOpenNow
              ? "bg-green-100/90 text-green-700"
              : "bg-white/85 text-slate-500"
          }`}
        >
          <IconClock size={12} />
          {b.isOpenNow ? "Açık" : "Kapalı"}
        </span>
      </div>

      {/* Gövde */}
      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900">{b.name}</h3>
            <p className="truncate text-sm text-slate-500">
              {b.district}, {b.city}
              {dist && <span className="font-medium text-brand-dark"> · {dist}</span>}
            </p>
          </div>
          {b.ratingCount > 0 && (
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-1.5 py-0.5 text-sm font-semibold text-amber-700">
              <IconStar size={13} filled />
              {b.ratingAvg.toFixed(1)}
              <span className="text-xs font-normal text-amber-600/80">
                ({b.ratingCount})
              </span>
            </div>
          )}
        </div>

        {(b.isNew || b.badges.length > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {b.isNew && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Yeni
              </span>
            )}
            <Badges badges={b.badges} />
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5 text-sm">
          <span className="inline-flex items-center gap-1 text-slate-600">
            <IconTruck size={15} />
            {b.deliveryMinDays != null && b.deliveryMaxDays != null
              ? `${b.deliveryMinDays}-${b.deliveryMaxDays} iş günü`
              : "Süre belirtilmedi"}
          </span>
          {b.minPrice != null && (
            <span className="font-semibold text-slate-900">
              {b.minPrice} TL/m²&apos;den
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
