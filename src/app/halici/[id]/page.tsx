import { jsonLdSafe } from "@/lib/htmlSafe";
import { seoGizliMi } from "@/lib/seoCoverage";
import { subscriptionActive } from "@/lib/subscription";
import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessById } from "@/lib/businesses";
import { publicTaxNumber } from "@/lib/taxId";
import { prisma } from "@/lib/prisma";
import { Badges } from "@/components/Badges";
import PriceEstimator from "@/components/PriceEstimator";
import { IconStar, IconTruck, IconWhatsApp } from "@/components/icons";
import EmptyState from "@/components/EmptyState";
import Footer from "@/components/Footer";
import { isMobilePhone } from "@/lib/phone";

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
  // Sipariş alabiliyor mu? (getBusinessById aboneliği döndürmüyor)
  // DEMO kaydı da burada okunur: komisyoncunun dükkânda gösterdiği panelin
  // işletmesi Google'a bildirilmez (bkz. lib/seoCoverage gizliFiltre).
  const [abonelik, demoKaydi] = await Promise.all([
    prisma.subscription.findUnique({
      where: { businessId: id },
      select: { status: true, currentPeriodEnd: true },
    }),
    prisma.cleanerBusiness.findUnique({
      where: { id },
      select: { isDemo: true },
    }),
  ]);
  return {
    title: `${b.name} — ${b.district} Halı Yıkama`,
    description:
      b.description ??
      `${b.district}, ${b.city} bölgesinde kapıdan halı yıkama servisi. Halın kapından alınır, yıkanır, teslim edilir.${ratingPart}`,
    openGraph: b.photos.length > 0 ? { images: [b.photos[0].url] } : undefined,
    // TEST/DEMO işletmesi aramaya kapalı (2026-07-27): kayıt canlıda duruyor
    // (Play incelemesi için ŞART, kullanıcı kararı) ama sahte bir işletmenin
    // "Kadıköy halı yıkama" aramasında çıkması gerçek müşteriyi yanıltır.
    // Kimlikler `SEO_NOINDEX_BUSINESS_IDS` ortam değişkeninde (virgüllü).
    // Aramaya kapalı: test/demo kaydı VEYA sipariş alamayan işletme
    // (aboneliği bitmiş / duraklatılmış). Google'dan gelen müşteriyi sipariş
    // veremeyeceği bir sayfaya düşürmek hem onu hem bizi yakıyordu (2026-07-28).
    ...(seoGizliMi(id) || demoKaydi?.isDemo || !subscriptionActive(abonelik)
      ? { robots: { index: false, follow: false } }
      : {}),
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

  // ETAHS Yön. md.5/2-b: vergi kimlik numarası gösterimi — ANCAK yalnız
  // 10 haneli VKN (tüzel kişi). Şahıs işletmesinde bu alan T.C. kimlik no'dur;
  // TCKN kişisel veridir (KVKK) ve müşteriye ASLA gösterilmez (publicTaxNumber
  // 11 haneli değeri null yapar).
  const taxNumber = publicTaxNumber(
    (
      await prisma.cleanerBusiness.findUnique({
        where: { id: b.id },
        select: { taxNumber: true },
      })
    )?.taxNumber ?? null,
  );

  // WhatsApp linki — Türkiye'de müşteri aramak yerine yazmayı tercih eder.
  // 05xx... → 905xx... (wa.me uluslararası biçim ister). YALNIZ cep telefonunda:
  // sabit hatta (0212/0342…) WhatsApp yok → kırık buton gösterme (null → gizlenir).
  const toWaHref = (raw: string) => {
    const d = raw.replace(/\D/g, "");
    return isMobilePhone(d)
      ? `https://wa.me/${d.replace(/^0/, "90")}?text=${encodeURIComponent(
          "Merhaba, halı yıkama hizmetiniz için yazıyorum.",
        )}`
      : null;
  };
  // Ana buton birincil GSM'i, o cep değilse ikinci GSM'i kullanır.
  const waHref = toWaHref(b.phone) ?? (b.gsmPhone2 ? toWaHref(b.gsmPhone2) : null);
  const gsmNumbers = [b.phone, ...(b.gsmPhone2 ? [b.gsmPhone2] : [])];

  // Tatil modu: duraklatılmışsa sipariş butonları kapanır (profil yayında kalır).
  const paused = b.pausedUntil != null;
  const pausedLabel = paused
    ? b.pausedUntil!.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
      })
    : null;

  const main = b.pricing.filter((p) => !p.isAddon);
  const addons = b.pricing.filter((p) => p.isAddon);
  // m² hesaplayıcısı yalnız m² bazlı ana fiyatlardan çalışır.
  const m2Prices = main.filter((p) => p.unit === "PER_M2").map((p) => p.price);
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
      streetAddress: b.address,
      addressLocality: b.district,
      addressRegion: b.city,
      addressCountry: "TR",
    },
    telephone: b.phone,
    url: `${base}/halici/${b.id}`,
  };
  // Görsel zengin sonuç şansını artırır (mutlak URL ister).
  if (b.photos.length > 0) {
    ld.image = b.photos.slice(0, 3).map((p) => `${base}${p.url}`);
  }
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
          dangerouslySetInnerHTML={{ __html: jsonLdSafe(ld) }}
        />
        {/* BreadcrumbList (2026-07-30): işletme adı KULLANICI VERİSİ —
            jsonLdSafe şart (4.5 stored-XSS dersi). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdSafe({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: base },
                { "@type": "ListItem", position: 2, name: "Halıcılar", item: `${base}/halicilar` },
                { "@type": "ListItem", position: 3, name: b.name },
              ],
            }),
          }}
        />
        <Link href="/" className="text-sm text-brand-dark hover:underline">
          ← Halıcılar
        </Link>

        <div className="mt-3 md:grid md:grid-cols-[1fr_360px] md:gap-8">
          {/* Sol kolon: başlık, fotoğraflar, açıklama */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {b.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.logoUrl}
                    alt={`${b.name} logosu`}
                    className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1"
                  />
                )}
                <div className="min-w-0">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {b.name}
                  </h1>
                  <p className="text-slate-500">
                    {b.district}, {b.city}
                  </p>
                </div>
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
              <Badges badges={b.badges} notlar={b.badgeNotes} />
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
                    {/* Genel işletme fotoğrafında rozet yok */}
                    {(p.isBefore || p.isAfter) && (
                      <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-white">
                        {p.isBefore ? "Öncesi" : "Sonrası"}
                      </span>
                    )}
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
            {paused ? (
              <div className="hidden rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800 md:block">
                {pausedLabel} tarihine kadar yeni sipariş almıyor
              </div>
            ) : (
              <Link
                href={`/halici/${b.id}/siparis`}
                className="hidden rounded-xl bg-brand py-3 text-center font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] md:block"
              >
                Halımı Aldır
              </Link>
            )}
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 hidden items-center justify-center gap-2 rounded-xl border-2 border-[#25D366] py-2.5 text-center font-semibold text-[#1da851] transition hover:bg-[#25D366]/10 active:scale-[0.99] md:flex"
              >
                <IconWhatsApp size={18} /> WhatsApp&apos;tan Yaz
              </a>
            )}

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
              {m2Prices.length > 0 && <PriceEstimator prices={m2Prices} />}
            </section>

            {/* İşletme bilgileri — ETAHS Yön. md.5/2 (VKN) + md.6/4 (doğrulama
                ibaresi) ve Mesafeli Söz. Yön. md.5/1-c (sipariş ÖNCESİ açık
                adres + telefon): tüketici sipariş vermeden ulaşabilmeli. */}
            <section className="mt-6">
              <h2 className="mb-2 font-semibold text-slate-900">
                İşletme Bilgileri
              </h2>
              <div className="rounded-lg border border-slate-200 bg-white text-sm">
                <div className="border-b border-slate-100 px-3 py-2 last:border-0">
                  <div className="text-slate-600">Açık adres</div>
                  <div className="text-slate-900">
                    {b.address}, {b.district} / {b.city}
                  </div>
                </div>
                {b.landlinePhone && (
                  <div className="border-b border-slate-100 px-3 py-2 last:border-0">
                    <div className="text-slate-600">Telefon (Sabit Hat)</div>
                    <a
                      href={`tel:${b.landlinePhone}`}
                      className="font-medium text-brand-dark hover:underline"
                    >
                      {b.landlinePhone}
                    </a>
                  </div>
                )}
                <div className="border-b border-slate-100 px-3 py-2 last:border-0">
                  <div className="text-slate-600">GSM &amp; WhatsApp</div>
                  {gsmNumbers.map((num) => (
                    <div key={num}>
                      <a
                        href={`tel:${num}`}
                        className="font-medium text-brand-dark hover:underline"
                      >
                        {num}
                      </a>
                    </div>
                  ))}
                </div>
                {taxNumber && (
                  <div className="border-b border-slate-100 px-3 py-2 last:border-0">
                    <div className="text-slate-600">Vergi kimlik no</div>
                    <div className="text-slate-900">{taxNumber}</div>
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Bu işletmenin doğrulanmış iletişim bilgileri ve merkez adresi
                platform kayıtlarında mevcuttur.
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900">Yorumlar</h2>
              {b.googleProfileUrl && (
                <a
                  href={b.googleProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <span className="font-bold" aria-hidden>
                    <span style={{ color: "#4285F4" }}>G</span>
                    <span style={{ color: "#EA4335" }}>o</span>
                    <span style={{ color: "#FBBC05" }}>o</span>
                    <span style={{ color: "#4285F4" }}>g</span>
                    <span style={{ color: "#34A853" }}>l</span>
                    <span style={{ color: "#EA4335" }}>e</span>
                  </span>
                  Yorumları →
                </a>
              )}
            </div>
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

        {/* Sabit CTA (mobil) — md+ ekranda sağ kolondaki butonlar kullanılır */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-3 md:hidden">
          <div className="mx-auto flex max-w-lg gap-2 md:max-w-3xl lg:max-w-5xl">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp'tan yaz"
                className="flex w-14 shrink-0 items-center justify-center rounded-xl border-2 border-[#25D366] text-[#1da851] transition hover:bg-[#25D366]/10 active:scale-[0.99]"
              >
                <IconWhatsApp size={22} />
              </a>
            )}
            {paused ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-center text-sm font-medium text-amber-800">
                {pausedLabel} tarihine kadar sipariş almıyor
              </div>
            ) : (
              <Link
                href={`/halici/${b.id}/siparis`}
                className="block flex-1 rounded-xl bg-brand py-3 text-center font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
              >
                Halımı Aldır
              </Link>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
