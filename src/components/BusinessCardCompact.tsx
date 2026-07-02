import Link from "next/link";
import { IconStar, IconTruck, Logo } from "@/components/icons";
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
      className="block w-44 shrink-0 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand hover:shadow-md"
    >
      <div className="mb-2 aspect-[4/3] overflow-hidden rounded-lg bg-brand-light">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.coverUrl}
            alt={b.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center opacity-60">
            <Logo size={36} />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
          <IconStar size={13} filled className="text-amber-500" />
          {b.ratingCount > 0 ? b.ratingAvg.toFixed(1) : "Yeni"}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            b.isOpenNow
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {b.isOpenNow ? "Açık" : "Kapalı"}
        </span>
      </div>
      <h3 className="mt-1 truncate text-sm font-medium text-slate-900">
        {b.name}
      </h3>
      <p className="truncate text-xs text-slate-500">
        {b.district}
        {dist ? ` · ${dist}` : ""}
      </p>
      <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-600">
        {b.deliveryMaxDays != null && <IconTruck size={12} />}
        <span className="truncate">
          {b.deliveryMaxDays != null
            ? `${b.deliveryMinDays}-${b.deliveryMaxDays} gün`
            : ""}
          {b.minPrice != null ? ` · ${b.minPrice} TL/m²` : ""}
        </span>
      </p>
    </Link>
  );
}
