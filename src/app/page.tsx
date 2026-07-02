import Link from "next/link";
import { getBusinesses } from "@/lib/businesses";
import { BusinessCard } from "@/components/BusinessCard";
import { BusinessRow } from "@/components/BusinessRow";
import { SearchBar } from "@/components/SearchBar";
import { BusinessesMapView } from "@/components/BusinessesMapView";
import {
  Logo,
  IconPackage,
  IconArrowRight,
  IconMapPin,
  IconStar,
  IconTruck,
  IconSparkles,
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

function Header() {
  return (
    <header className="flex items-center justify-between py-4">
      <Link href="/" className="flex min-w-0 items-center gap-2">
        <Logo size={30} />
        <span className="whitespace-nowrap text-sm font-bold tracking-tight text-slate-900 sm:text-lg">
          En Yakın Halı Yıkama
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <Link
          href="/takip"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-brand-dark"
        >
          <IconPackage size={17} />
          <span className="hidden sm:inline">Takip</span>
        </Link>
        <Link
          href="/giris"
          className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-slate-600 hover:text-brand-dark"
        >
          <span className="sm:hidden">Giriş</span>
          <span className="hidden sm:inline">İşletme girişi</span>
          <IconArrowRight size={15} />
        </Link>
      </div>
    </header>
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

  const searchBar = (
    <SearchBar
      q={sp.q}
      district={sp.district}
      lat={sp.lat}
      lng={sp.lng}
      sort={sp.sort}
      maxPrice={sp.maxPrice}
      minRating={sp.minRating}
      openNow={sp.openNow}
      view={sp.view}
    />
  );

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
      <main className="mx-auto w-full max-w-lg px-4 pb-12 md:max-w-3xl lg:max-w-5xl">
        <Header />
        {searchBar}
        <div className="mb-3 mt-5 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold text-slate-900">{heading}</h1>
          <span className="text-sm text-slate-400">
            {businesses.length} sonuç
          </span>
        </div>
        {view === "map" ? (
          <BusinessesMapView businesses={businesses} center={userCenter} />
        ) : businesses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            Bu aramada halıcı bulunamadı. Filtreleri gevşetin ya da farklı semt
            deneyin.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => (
              <BusinessCard key={b.id} b={b} />
            ))}
          </div>
        )}
      </main>
    );
  }

  // ---- Keşif modu (Çiçek Sepeti tarzı sıralı yatay satırlar) ----
  const all = await getBusinesses({ lat, lng });
  const nearest = lat != null ? all.filter((b) => b.distanceKm != null).slice(0, 10) : [];
  const topRated = [...all]
    .filter((b) => b.ratingCount > 0)
    .sort((a, b) => b.ratingAvg - a.ratingAvg)
    .slice(0, 10);
  const fastest = [...all]
    .filter((b) => b.deliveryMaxDays != null)
    .sort((a, b) => (a.deliveryMaxDays as number) - (b.deliveryMaxDays as number))
    .slice(0, 10);
  const fresh = all.filter((b) => b.isNew).slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-12 md:max-w-3xl lg:max-w-5xl">
      <Header />
      <p className="mb-3 text-sm text-slate-500">
        Halıcını seç, halını kapından aldır, adım adım takip et.
      </p>
      {searchBar}

      {all.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Henüz halıcı yok.
        </div>
      ) : (
        <>
          <BusinessRow
            title="Sana en yakın"
            icon={<IconMapPin size={18} />}
            businesses={nearest}
            seeAllHref={lat != null ? `/?lat=${lat}&lng=${lng}&view=list` : undefined}
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
      )}
    </main>
  );
}
