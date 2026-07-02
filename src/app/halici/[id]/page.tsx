import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessById } from "@/lib/businesses";
import { Badges } from "@/components/Badges";
import { IconStar, IconTruck } from "@/components/icons";
import EmptyState from "@/components/EmptyState";
import Footer from "@/components/Footer";

// generateMetadata + sayfa aynı isteği paylaşsın diye tek render içinde önbellekle.
const getBusiness = cache(getBusinessById);

const DAYS: [string, string][] = [
  ["mon", "Pazartesi"],
  ["tue", "Salı"],
  ["wed", "Çarşamba"],
  ["thu", "Perşembe"],
  ["fri", "Cuma"],
  ["sat", "Cumartesi"],
  ["sun", "Pazar"],
];

const UNIT_LABEL: Record<string, string> = {
  PER_M2: "/ m²",
  PER_PIECE: "/ adet",
  FLAT: "(sabit)",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const b = await getBusiness(id);
  if (!b) {
    return { title: "İşletme bulunamadı", robots: { index: false } };
  }
  const ratingPart =
    b.ratingCount > 0
      ? ` ${b.ratingAvg.toFixed(1)}★ (${b.ratingCount} yorum).`
      : "";
  return {
    title: `${b.name} — ${b.district} Halı Yıkama`,
    description:
      b.description ??
      `${b.district}, ${b.city} bölgesinde kapıdan halı yıkama servisi. Halın kapından alınır, yıkanır, teslim edilir.${ratingPart}`,
    openGraph: b.photos.length > 0 ? { images: [b.photos[0].url] } : undefined,
  };
}

export default async function HaliciProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const b = await getBusiness(id);
  if (!b) notFound();

  const main = b.pricing.filter((p) => !p.isAddon);
  const addons = b.pricing.filter((p) => p.isAddon);
  const hours = (b.workingHours ?? {}) as Record<
    string,
    { open: string; close: string } | null
  >;

  // LocalBusiness yapılandırılmış verisi — yerel aramada zengin sonuç için.
  const base = process.env.APP_BASE_URL ?? "https://enyakinhaliyikamaservisi.com";
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    address: {
      "@type": "PostalAddress",
      addressLocality: b.district,
      addressRegion: b.city,
      addressCountry: "TR",
    },
    telephone: b.phone,
    url: `${base}/halici/${b.id}`,
  };
  // 0 yorumla aggregateRating şema spam sayılır; yalnız gerçek puan varsa ekle.
  if (b.ratingCount > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(b.ratingAvg.toFixed(1)),
      reviewCount: b.ratingCount,
    };
  }

  return (
    <>
      <main className="mx-auto max-w-lg px-4 py-6 pb-28 md:max-w-3xl md:pb-12 lg:max-w-5xl">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
        <Link href="/" className="text-sm text-brand-dark hover:underline">
          ← Halıcılar
        </Link>

        <div className="mt-3 md:grid md:grid-cols-[1fr_360px] md:gap-8">
          {/* Sol kolon: başlık, fotoğraflar, açıklama */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  {b.name}
                </h1>
                <p className="text-slate-500">
                  {b.district}, {b.city}
                </p>
              </div>
              {b.ratingCount > 0 ? (
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-lg font-bold text-slate-900">
                    <IconStar
                      size={18}
                      filled
                      className="shrink-0 text-amber-500"
                    />
                    {b.ratingAvg.toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {b.ratingCount} yorum
                  </div>
                </div>
              ) : (
                <span className="mt-1 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                  Yeni işletme · henüz yorum yok
                </span>
              )}
            </div>

            <div className="mt-3">
              <Badges badges={b.badges} />
            </div>

            {/* Fotoğraflar (before/after) */}
            {b.photos.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3">
                {b.photos.map((p, i) => (
                  <div
                    key={i}
                    className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={p.caption ?? ""}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-white">
                      {p.isBefore ? "Öncesi" : "Sonrası"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {b.description && (
              <p className="mt-4 text-sm text-slate-600">{b.description}</p>
            )}

            <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-light px-3 py-2 text-sm font-medium text-brand-dark">
              <IconTruck size={16} /> Tahmini teslim:{" "}
              {b.deliveryMinDays != null && b.deliveryMaxDays != null
                ? `${b.deliveryMinDays}-${b.deliveryMaxDays} iş günü`
                : "Belirtilmedi"}
            </div>
          </div>

          {/* Sağ kolon (md+ sticky): CTA + fiyatlandırma + çalışma saatleri */}
          <aside className="md:sticky md:top-6 md:row-span-2 md:self-start">
            <Link
              href={`/halici/${b.id}/siparis`}
              className="hidden rounded-xl bg-brand py-3 text-center font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] md:block"
            >
              Halımı Aldır
            </Link>

            {/* Fiyatlandırma */}
            <section className="mt-6">
              <h2 className="mb-2 font-semibold text-slate-900">
                Fiyatlandırma
              </h2>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {main.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-0"
                  >
                    <span className="text-slate-700">{p.label}</span>
                    <span className="font-medium text-slate-900">
                      {p.price} TL {UNIT_LABEL[p.unit]}
                    </span>
                  </div>
                ))}
              </div>
              {addons.length > 0 && (
                <>
                  <h3 className="mb-1 mt-3 text-sm font-semibold text-slate-700">
                    Ek hizmetler
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {addons.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-0"
                      >
                        <span className="text-slate-700">{p.label}</span>
                        <span className="font-medium text-slate-900">
                          {p.price} TL {UNIT_LABEL[p.unit]}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <p className="mt-2 text-xs text-slate-600">
                Kesin fiyat, halı alındıktan ve görüldükten sonra netleşir.
              </p>
            </section>

            {/* Çalışma saatleri */}
            <section className="mt-6">
              <h2 className="mb-2 font-semibold text-slate-900">
                Çalışma Saatleri
              </h2>
              <div className="rounded-lg border border-slate-200 bg-white text-sm">
                {DAYS.map(([key, label]) => {
                  const h = hours[key];
                  return (
                    <div
                      key={key}
                      className="flex justify-between border-b border-slate-100 px-3 py-1.5 last:border-0"
                    >
                      <span className="text-slate-600">{label}</span>
                      <span className="text-slate-900">
                        {h ? `${h.open} - ${h.close}` : "Kapalı"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>

          {/* Sol kolon devamı: yorumlar */}
          <section className="mt-6 md:mt-0">
            <h2 className="mb-2 font-semibold text-slate-900">Yorumlar</h2>
            {b.reviews.length > 0 ? (
              <div className="space-y-2">
                {b.reviews.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">
                        {r.customerName}
                      </span>
                      <span
                        role="img"
                        className="flex items-center gap-0.5"
                        aria-label={`5 üzerinden ${r.rating} yıldız`}
                      >
                        {Array.from({ length: 5 }).map((_, si) => (
                          <IconStar
                            key={si}
                            size={14}
                            filled
                            className={
                              si < r.rating
                                ? "text-amber-500"
                                : "text-slate-300"
                            }
                          />
                        ))}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-1 text-sm text-slate-600">{r.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<IconStar size={22} filled />}
                title="İlk yorumu sen bırak"
                description="Bu işletme henüz yeni — siparişin teslim edildikten sonra deneyimini paylaşan ilk müşteri olabilirsin."
              />
            )}
          </section>
        </div>

        {/* Sabit CTA (mobil) — md+ ekranda sağ kolondaki buton kullanılır */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-3 md:hidden">
          <div className="mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl">
            <Link
              href={`/halici/${b.id}/siparis`}
              className="block rounded-xl bg-brand py-3 text-center font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
            >
              Halımı Aldır
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
