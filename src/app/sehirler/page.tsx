import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
import { CITIES } from "@/lib/cities";

export const metadata: Metadata = {
  title: "Şehirlere Göre Halı Yıkama — 81 İlde Servis",
  description:
    "Türkiye'nin 81 ilinde halı yıkama servisi: şehrini seç, yakınındaki halı yıkamacıları karşılaştır, halın kapından alınsın. Ön ödeme yok, ödeme teslimde.",
  alternates: { canonical: "/sehirler" },
};

export default function CitiesPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-lg px-4 pb-12 md:max-w-3xl lg:max-w-5xl">
        <SiteHeader />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Şehirlere göre halı yıkama
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600 sm:text-base">
          Şehrini seç, yakınındaki halı yıkamacıları gör. Halın kapından
          alınır, yıkanır, kapına teslim edilir — ödeme teslimde.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {CITIES.map((c) => (
            <Link
              key={c.slug}
              href={`/hali-yikama/${c.slug}`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm transition hover:border-brand hover:text-brand-dark"
            >
              {c.name} halı yıkama
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
