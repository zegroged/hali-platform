import Link from "next/link";
import type { ReactNode } from "react";
import { BusinessCardCompact } from "@/components/BusinessCardCompact";
import { IconArrowRight } from "@/components/icons";
import type { BusinessSummary } from "@/lib/businesses";

export function BusinessRow({
  title,
  icon,
  businesses,
  seeAllHref,
}: {
  title: string;
  icon?: ReactNode;
  businesses: BusinessSummary[];
  seeAllHref?: string;
}) {
  if (!businesses.length) return null;
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-semibold text-slate-900">
          {icon && <span className="text-brand">{icon}</span>}
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-dark hover:underline"
          >
            Tümünü gör
            <IconArrowRight size={15} />
          </Link>
        )}
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {businesses.map((b) => (
          <div key={b.id} className="snap-start">
            <BusinessCardCompact b={b} />
          </div>
        ))}
      </div>
    </section>
  );
}
