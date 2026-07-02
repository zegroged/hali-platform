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
      <div className="relative">
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4">
          {businesses.map((b) => (
            <div key={b.id} className="snap-start">
              <BusinessCardCompact b={b} />
            </div>
          ))}
        </div>
        {/* Scrollbar gizlendiği için kaydırılabilirlik ipucu: sağ kenarda fade (md+) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -right-4 hidden w-10 bg-gradient-to-l from-slate-50 md:block"
        />
      </div>
    </section>
  );
}
