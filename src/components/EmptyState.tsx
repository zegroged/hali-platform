import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Ortak boş-durum kutusu: ikon + başlık + açıklama + isteğe bağlı aksiyon.
 * Aksiyonsuz tek satır gri metin yerine her boş listede bunu kullan.
 */
export default function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      {icon ? (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-dark">
          {icon}
        </div>
      ) : null}
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
          {description}
        </p>
      ) : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
