import Link from "next/link";
import type { ReactNode } from "react";
import Footer from "@/components/Footer";
import { Logo } from "@/components/icons";

/**
 * Yasal/statik sayfaların ortak kabuğu: üstte ana sayfaya dönüş header'ı,
 * dar içerik sütunu (max-w-lg md:max-w-3xl), altta kurumsal Footer.
 * (_static klasörü Next'te route üretmez — yalnız paylaşılan parça.)
 */
export default function StaticPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3 md:max-w-3xl">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <Logo size={26} />
            <span className="whitespace-nowrap text-sm font-bold tracking-tight text-slate-900 sm:text-base">
              En Yakın Halı Yıkama
            </span>
          </Link>
          <Link
            href="/"
            className="shrink-0 py-2 text-sm font-medium text-brand-dark hover:underline"
          >
            ← Ana sayfa
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 md:max-w-3xl">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h1>
        {intro ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{intro}</p>
        ) : null}
        <div className="mt-6 space-y-6">{children}</div>
      </main>

      <Footer />
    </div>
  );
}

/** İçerik bölümü: küçük başlık + prose benzeri paragraf stili. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}
