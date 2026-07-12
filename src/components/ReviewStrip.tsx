import Link from "next/link";
import { IconStar } from "@/components/icons";
import type { RecentReview } from "@/lib/businesses";

/**
 * Son değerlendirmeler şeridi — sosyal kanıt (ana sayfa + şehir sayfaları).
 * Sunucu bileşeni; yorum yoksa hiç render edilmez (çağıran kontrol eder).
 */
export default function ReviewStrip({
  reviews,
  title = "Müşteriler ne diyor?",
}: {
  reviews: RecentReview[];
  title?: string;
}) {
  if (reviews.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-semibold text-slate-900">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r, i) => (
          <figure
            key={i}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div
              className="flex items-center gap-0.5 text-amber-500"
              aria-label={`${r.rating} yıldız`}
            >
              {Array.from({ length: 5 }, (_, s) => (
                <IconStar
                  key={s}
                  size={14}
                  filled={s < r.rating}
                  className={s < r.rating ? "" : "text-slate-300"}
                />
              ))}
            </div>
            <blockquote className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-700">
              &ldquo;{r.comment}&rdquo;
            </blockquote>
            <figcaption className="mt-3 text-xs text-slate-500">
              {r.customerName} ·{" "}
              <Link
                href={`/halici/${r.businessId}`}
                className="font-medium text-brand-dark hover:underline"
              >
                {r.businessName}
              </Link>
              , {r.district}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
