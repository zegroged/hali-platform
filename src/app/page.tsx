import Link from "next/link";
import { getBusinesses, getRecentReviews } from "@/lib/businesses";
import ReviewStrip from "@/components/ReviewStrip";
import { BusinessCard } from "@/components/BusinessCard";
import { BusinessRow } from "@/components/BusinessRow";
import { SearchBar } from "@/components/SearchBar";
import { BusinessesMapView } from "@/components/BusinessesMapView";
import Footer from "@/components/Footer";
import TrackingBar from "@/components/TrackingBar";
import SiteHeader from "@/components/SiteHeader";
import HowItWorks from "@/components/HowItWorks";
import { DISTRICTS } from "@/components/districts";
import { featuredCities } from "@/lib/cities";
import {
  IconMapPin,
  IconStar,
  IconTruck,
  IconSparkles,
  IconWallet,
} from "@/components/icons";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  district?: string;
  lat?: string;
  lng?: string;
  q?: string;
  sort?: string;
  maxPrice?: string;
  minRating?: string;
  openNow?: string;
  view?: string;
}>;

/** Ana sayfa SSS — müşteri odaklı 6 soru, açılır-kapanır (tümü /sss'te). */
function HomeFaq() {
  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "Siparişimi nasıl takip ederim?",
      a: "Halıcı siparişi oluşturduğunda sana 6 haneli bir takip kodu ve bağlantı verir. Yukarıdaki takip kutusuna kodu girerek halının hangi aşamada olduğunu (alındı, yıkanıyor, yolda, teslim) anlık görürsün.",
    },
    {
      q: "Fiyat nasıl netleşir?",
      a: "Profillerdeki fiyatlar m² başına tahminidir. Halın kapından alınıp ölçüldükten sonra kesin fiyat sana bildirilir; uygun bulmazsan halın yıkanmadan ücretsiz geri getirilir.",
    },
    {
      q: "Ödemeyi ne zaman yapıyorum?",
      a: "Ödeme teslimatta yapılır — sipariş verirken hiçbir ön ödeme veya kapora alınmaz. Halın temiz şekilde kapına geldiğinde ücretini doğrudan halıcıya ödersin.",
    },
    {
      q: "Halım kaç günde teslim edilir?",
      a: "Süre işletmeye ve yoğunluğa göre değişir; her halıcının profilinde tahmini teslim süresi (örn. 2-4 iş günü) yazar. Süre, halın alındığında netleşir.",
    },
    {
      q: "Halım kaybolursa veya zarar görürse ne olur?",
      a: "Her sipariş kayıt altındadır; hangi işletmenin ne zaman aldığı ve teslim ettiği adım adım izlenir. Hasar/kayıp durumunda hizmeti veren işletme sorumludur, platform olarak çözüm sürecine aracılık ederiz.",
    },
    {
      q: "Hangi bölgelerde hizmet var?",
      a: (
        <>
          Platform yeni ve bölge bölge açılıyoruz. Yukarıdan adresini aratarak
          veya konumunu kullanarak bölgende hizmet veren halıcıları
          görebilirsin;{" "}
          <Link href="/sehirler" className="font-medium text-brand-dark underline">
            şehirlere göre halı yıkama
          </Link>{" "}
          sayfasından da iline bakabilirsin.
        </>
      ),
    },
  ];
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-slate-900">Sık sorulan sorular</h2>
        <Link
          href="/sss"
          className="shrink-0 text-sm font-medium text-brand-dark hover:underline"
        >
          Tümünü gör
        </Link>
      </div>
      <div className="space-y-2.5">
        {faqs.map((f, i) => (
          <details
            key={i}
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
  );
}

/** Şehir kısayolları — şehir SEO sayfalarına iç link (indekslenme için). */
function CityShortcuts() {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-slate-900">
          Şehrinde halı yıkama servisi
        </h2>
        <Link
          href="/sehirler"
          className="shrink-0 text-sm font-medium text-brand-dark hover:underline"
        >
          Tüm şehirler
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {featuredCities().map((c) => (
          <Link
            key={c.slug}
            href={`/hali-yikama/${c.slug}`}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:border-brand hover:text-brand-dark"
          >
            {c.name} halı yıkama
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const lat = sp.lat ? Number(sp.lat) : undefined;
  const lng = sp.lng ? Number(sp.lng) : undefined;
  const sort =
    sp.sort === "rating" || sp.sort === "fastest" ? sp.sort : "nearest";

  const hasQuery = Boolean(
    sp.q ||
      sp.district ||
      sp.maxPrice ||
      sp.minRating ||
      sp.openNow ||
      sp.view ||
      (sp.sort && sp.sort !== "nearest"),
  );

  const searchProps = {
    q: sp.q,
    district: sp.district,
    lat: sp.lat,
    lng: sp.lng,
    sort: sp.sort,
    maxPrice: sp.maxPrice,
    minRating: sp.minRating,
    openNow: sp.openNow,
    view: sp.view,
  };

  // ---- Sonuç modu (arama/filtre/semt/harita) ----
  if (hasQuery) {
    const businesses = await getBusinesses({
      district: sp.district,
      lat,
      lng,
      maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
      minRating: sp.minRating ? Number(sp.minRating) : undefined,
      openNow: sp.openNow === "1",
      sort,
    });
    const view = sp.view === "map" ? "map" : "list";
    const userCenter =
      lat != null && lng != null ? { lat, lng } : undefined;
    const heading = sp.district
      ? `${sp.district} halıcıları`
      : lat != null
        ? "Sana en yakın halıcılar"
        : "Sonuçlar";

    return (
      <>
        <main className="mx-auto w-full max-w-lg px-4 pb-12 md:max-w-3xl lg:max-w-5xl">
          <SiteHeader />
          <SearchBar {...searchProps} />
          <div className="mb-3 mt-5 flex items-baseline justify-between">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {heading}
            </h1>
            {businesses.length > 0 && (
              <span className="text-sm text-slate-500">
                {businesses.length} sonuç
              </span>
            )}
          </div>
          {view === "map" ? (
            <BusinessesMapView businesses={businesses} center={userCenter} />
          ) : businesses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Bu aramada halıcı bulunamadı
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
                Filtreleri gevşetmeyi ya da farklı bir semtte aramayı
                deneyebilirsin.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {DISTRICTS.map((d) => (
                  <Link
                    key={d}
                    href={`/?district=${encodeURIComponent(d)}`}
                    className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-brand hover:text-brand-dark"
                  >
                    {d}
                  </Link>
                ))}
              </div>
              <Link
                href="/"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
              >
                Filtreleri temizle
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.map((b) => (
                <BusinessCard key={b.id} b={b} />
              ))}
            </div>
          )}
        </main>
        <Footer />
      </>
    );
  }

  // ---- Keşif modu (Çiçek Sepeti tarzı sıralı yatay satırlar) ----
  const [all, recentReviews] = await Promise.all([
    getBusinesses({ lat, lng }),
    getRecentReviews(undefined, 6),
  ]);
  const nearest =
    lat != null ? all.filter((b) => b.distanceKm != null).slice(0, 10) : [];
  const topRated = [...all]
    .filter((b) => b.ratingCount > 0)
    .sort((a, b) => b.ratingAvg - a.ratingAvg)
    .slice(0, 10);
  const fastest = [...all]
    .filter((b) => b.deliveryMaxDays != null)
    .sort(
      (a, b) => (a.deliveryMaxDays as number) - (b.deliveryMaxDays as number),
    )
    .slice(0, 10);
  const fresh = all.filter((b) => b.isNew).slice(0, 10);
  const anyRow =
    nearest.length > 0 ||
    topRated.length > 0 ||
    fastest.length > 0 ||
    fresh.length > 0;

  return (
    <>
      <main className="mx-auto w-full max-w-lg px-4 pb-12 md:max-w-3xl lg:max-w-5xl">
        <SiteHeader />

        {/* Hero: marka bandı — değer önerisi + güven rozetleri + arama kartı */}
        <section className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-4 sm:p-6">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            En yakın halı yıkamacıyı bul
          </h1>
          <p className="mt-1.5 text-sm text-teal-50 sm:text-base">
            Halıcını seç, halın kapından alınsın, adım adım takip et.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
              <IconWallet size={14} /> Ödeme teslimde · Ön ödeme yok
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
              <IconTruck size={14} /> Canlı takip
            </span>
          </div>
          <div className="mt-4">
            <SearchBar {...searchProps} totalCount={all.length} />
          </div>
        </section>

        {/* Mevcut siparişi olan müşteri için belirgin takip girişi */}
        <TrackingBar />

        {all.length === 0 ? (
          <>
            {/* Lansman ekranı: müşteriye "çok yakında" + nasıl çalışır + işletme CTA'sı */}
            <section className="mt-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand-dark">
                <IconSparkles size={26} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900 sm:text-xl">
                Bölgendeki halıcılar çok yakında burada
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                Platform yepyeni — halı yıkama işletmeleri şu anda ekleniyor.
                Açılışta en yakın halıcıyı buradan seçip halını kapından
                aldırabileceksin.
              </p>
            </section>
            <HowItWorks />
          </>
        ) : (
          <>
            {anyRow ? (
              <>
                <BusinessRow
                  title="Sana en yakın"
                  icon={<IconMapPin size={18} />}
                  businesses={nearest}
                  seeAllHref={
                    lat != null ? `/?lat=${lat}&lng=${lng}&view=list` : undefined
                  }
                />
                <BusinessRow
                  title="En çok tercih edilenler"
                  icon={<IconStar size={18} filled />}
                  businesses={topRated}
                  seeAllHref="/?sort=rating"
                />
                <BusinessRow
                  title="Hızlı teslim"
                  icon={<IconTruck size={18} />}
                  businesses={fastest}
                  seeAllHref="/?sort=fastest"
                />
                <BusinessRow
                  title="Yeni halıcılar"
                  icon={<IconSparkles size={18} />}
                  businesses={fresh}
                  seeAllHref="/?view=list"
                />
              </>
            ) : (
              /* Dört keşif satırı da boşsa mevcut halıcılar görünmez kalmasın. */
              <section className="mt-6">
                <h2 className="mb-2.5 font-semibold text-slate-900">
                  Tüm halıcılar
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {all.map((b) => (
                    <BusinessCard key={b.id} b={b} />
                  ))}
                </div>
              </section>
            )}
            <HowItWorks />
          </>
        )}

        <ReviewStrip reviews={recentReviews} />
        <CityShortcuts />
        <HomeFaq />
      </main>
      <Footer />
    </>
  );
}
