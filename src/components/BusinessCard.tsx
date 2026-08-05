import Link from "next/link";
import FotoKapak from "@/components/FotoKapak";
import { IconTruck, IconClock } from "@/components/icons";
import { RatingPill } from "@/components/RatingPill";
import type { BusinessSummary } from "@/lib/businesses";

export function BusinessCard({ b }: { b: BusinessSummary }) {
  const dist =
    b.distanceKm != null
      ? b.distanceKm < 1
        ? `${Math.round(b.distanceKm * 1000)} m`
        : `${b.distanceKm.toFixed(1)} km`
      : null;

  return (
    <Link
      href={`/halici/${b.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-brand hover:shadow-md active:scale-[0.98]"
    >
      {/* Kapak görseli — kırpmadan, bulanık dolgulu (bkz. FotoKapak) */}
      <div className="relative">
        <FotoKapak url={b.coverUrl} alt={b.name} />
        {/* İşletme logosu — kapak görselinin köşesinde küçük kart */}
        {b.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.logoUrl}
            alt=""
            loading="lazy"
            className="absolute bottom-2 left-2 h-10 w-10 rounded-lg border border-slate-200 bg-white object-contain p-0.5 shadow-sm"
          />
        )}
        {/* Tatil modunda "Açık" rozetiyle çelişmesin — tek rozet göster */}
        {b.isPaused ? (
          <span className="absolute left-2 top-2 rounded-full bg-amber-100/95 px-2 py-0.5 text-xs font-medium text-amber-800 backdrop-blur">
            Şu an sipariş almıyor
          </span>
        ) : (
          <span
            className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur ${
              b.isOpenNow
                ? "bg-green-100/90 text-green-700"
                : "bg-white/85 text-slate-500"
            }`}
          >
            <IconClock size={12} />
            {b.isOpenNow ? "Açık" : (b.opensAtLabel ?? "Kapalı")}
          </span>
        )}
      </div>

      {/* Gövde */}
      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900">{b.name}</h3>
            <p className="truncate text-sm text-slate-500">
              {b.district}, {b.city}
              {dist && (
                <span className="font-medium text-brand-dark"> · {dist}</span>
              )}
            </p>
          </div>
          <RatingPill
            ratingAvg={b.ratingAvg}
            ratingCount={b.ratingCount}
            showCount
          />
        </div>

        {/* ROZETLER KALDIRILDI (2026-08-03, kullanıcı kararı: "rozetleri
            kaldıralım, zaten bütün bilgileri alıyoruz"). Kart zaten puanı,
            teslim süresini, fiyatı, açık/kapalı durumunu ve mesafeyi
            gösteriyor; rozet çipleri bunların üstüne görsel gürültü
            ekliyordu. Rozet HESABI arka planda duruyor (lib/badgeCompute),
            geri açmak tek satır. */}
        {/* "Yeni" çipi de kaldırıldı (2026-08-04) — bkz. RatingPill. */}

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5 text-sm">
          {/* ALT ŞERİT — BOŞLUĞU İLAN ETMEZ (2026-07-30).
              Canlıda 34 işletmenin 13'ünde fiyat, çoğunda teslim süresi yok;
              hepsinde yorum yok. Eski hâlde bu satır "Süre belirtilmedi" yazıp
              yanını boş bırakıyordu — yani kart, müşteriye BİLMEDİĞİNİ
              duyuruyordu. Telefonda ekrana 1-2 kart girdiği için bu, listeyi
              olduğundan zayıf gösteriyor. Artık yalnız BİLİNEN bilgi yazılır;
              hiçbiri yoksa satır hiç çizilmez. */}
          {(b.deliveryMinDays != null && b.deliveryMaxDays != null) ||
          b.minPrice != null ? (
            <>
              <span className="inline-flex items-center gap-1 text-slate-600">
                {b.deliveryMinDays != null && b.deliveryMaxDays != null ? (
                  <>
                    <IconTruck size={15} />
                    {`${b.deliveryMinDays}-${b.deliveryMaxDays} iş günü`}
                  </>
                ) : (
                  <>
                    <IconTruck size={15} />
                    Kapıdan alım
                  </>
                )}
              </span>
              {b.minPrice != null && (
                <span className="font-semibold text-slate-900">
                  {b.minPrice} TL/m²&apos;den
                </span>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-600">
              <IconTruck size={15} /> Kapıdan alım · ödeme teslimde
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
