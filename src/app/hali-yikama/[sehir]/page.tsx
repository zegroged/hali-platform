import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinesses } from "@/lib/businesses";
import { BusinessCard } from "@/components/BusinessCard";
import SiteHeader from "@/components/SiteHeader";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";
import TrackingBar from "@/components/TrackingBar";
import { CITIES, cityBySlug, locative } from "@/lib/cities";
import { IconSparkles, IconTruck, IconWallet } from "@/components/icons";

// DB'den işletme listesi çekilir; build anında DB yok (bkz sitemap.ts notu).
export const dynamic = "force-dynamic";

type Params = Promise<{ sehir: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { sehir } = await params;
  const city = cityBySlug(sehir);
  if (!city) return {};
  return {
    title: `${city.name} Halı Yıkama — Kapıdan Alma, Yıkama, Teslimat`,
    description: `${locative(city.name)} halı yıkama servisi: yakınındaki halı yıkamacıları karşılaştır, halın kapından alınsın, adım adım takip et. Ön ödeme yok, ödeme teslimde.`,
    alternates: { canonical: `/hali-yikama/${city.slug}` },
  };
}

function cityFaqs(name: string): { q: string; a: string }[] {
  const loc = locative(name);
  return [
    {
      q: `${name} halı yıkama fiyatları ne kadar?`,
      a: `Fiyat, işletmeye ve halının m²'sine göre değişir. ${loc} hizmet veren halıcıların profillerinde m² başına tahmini fiyatlar yazar; halın kapından alınıp ölçüldükten sonra kesin fiyat sana bildirilir. Uygun bulmazsan halın yıkanmadan ücretsiz geri getirilir.`,
    },
    {
      q: `${loc} halım kapıdan alınıyor mu?`,
      a: `Evet. Seçtiğin halı yıkama işletmesi halını adresinden teslim alır, yıkandıktan sonra kapına geri getirir. Sipariş verirken ön ödeme veya kapora alınmaz — ödeme teslimde yapılır.`,
    },
    {
      q: "Halım kaç günde teslim edilir?",
      a: "Süre işletmeye ve yoğunluğa göre değişir; her halıcının profilinde tahmini teslim süresi (örn. 2-4 iş günü) yazar. Kesin süre, halın alındığında netleşir.",
    },
    {
      q: "Siparişimi nasıl takip ederim?",
      a: "Sipariş oluşturulduğunda sana 6 haneli bir takip kodu verilir. Takip sayfasına kodu girerek halının hangi aşamada olduğunu (alındı, yıkanıyor, yolda, teslim) anlık görürsün.",
    },
    {
      q: `${loc} hangi ilçelere hizmet var?`,
      a: `Her işletme hizmet verdiği ilçeleri profilinde belirtir. Adresini aratarak veya konumunu kullanarak ${loc} sana hizmet veren halıcıları görebilirsin.`,
    },
  ];
}

export default async function CityPage({ params }: { params: Params }) {
  const { sehir } = await params;
  const city = cityBySlug(sehir);
  if (!city) notFound();

  const businesses = await getBusinesses({ city: city.name, sort: "rating" });
  const faqs = cityFaqs(city.name);
  const loc = locative(city.name);
  const otherCities = CITIES.filter((c) => c.slug !== city.slug);

  // FAQPage yapılandırılmış verisi — şehir sayfalarının aranma amacı SEO.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <main className="mx-auto w-full max-w-lg px-4 pb-12 md:max-w-3xl lg:max-w-5xl">
        <SiteHeader />

        <section className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-4 sm:p-6">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {city.name} Halı Yıkama
          </h1>
          <p className="mt-1.5 text-sm text-teal-50 sm:text-base">
            {loc} halı yıkama servisi: halıcını seç, halın kapından alınsın,
            adım adım takip et.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
              <IconWallet size={14} /> Ödeme teslimde · Ön ödeme yok
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
              <IconTruck size={14} /> Canlı takip
            </span>
          </div>
        </section>

        <TrackingBar />

        {businesses.length > 0 ? (
          <section className="mt-8">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {city.name} halı yıkama firmaları
              </h2>
              <span className="text-sm text-slate-500">
                {businesses.length} işletme
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.map((b) => (
                <BusinessCard key={b.id} b={b} />
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand-dark">
              <IconSparkles size={26} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 sm:text-xl">
              {loc} halı yıkama servisi çok yakında
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
              Platform yepyeni — halı yıkama işletmeleri şehir şehir ekleniyor.
              Açılışta {loc} en yakın halıcıyı buradan seçip halını kapından
              aldırabileceksin.
            </p>
          </section>
        )}

        <HowItWorks />

        {/* Halıcılar için kayıt CTA'sı — şehir sayfaları işletme kazanımının da kanalı */}
        <section className="mt-8 rounded-2xl border border-brand/30 bg-brand-light/50 p-4 sm:p-6">
          <h2 className="font-semibold text-slate-900">
            {loc} halı yıkama işletmen mi var?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            İşletmeni platforma ekle; müşteri siparişleri, şoför takibi ve
            değerlendirmelerle {loc} öne çık.
          </p>
          <Link
            href="/kayit"
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
          >
            İşletmeni ekle
          </Link>
        </section>

        <section className="mt-10">
          <h2 className="font-semibold text-slate-900">
            {city.name} halı yıkama hakkında sık sorulanlar
          </h2>
          <div className="mt-3 space-y-2.5">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span
                    aria-hidden
                    className="shrink-0 text-slate-500 transition-transform group-open:rotate-90"
                  >
                    ›
                  </span>
                </summary>
                <p className="border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-600">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-semibold text-slate-900">
              Diğer şehirlerde halı yıkama
            </h2>
            <Link
              href="/sehirler"
              className="shrink-0 text-sm font-medium text-brand-dark hover:underline"
            >
              Tüm şehirler
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-2">
            {otherCities.map((c) => (
              <Link
                key={c.slug}
                href={`/hali-yikama/${c.slug}`}
                className="text-sm text-slate-500 hover:text-brand-dark hover:underline"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  );
}
