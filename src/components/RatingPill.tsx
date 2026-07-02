import { IconStar } from "@/components/icons";

/**
 * Ortak puan rozeti — BusinessCard ve BusinessCardCompact aynı mantığı kullanır:
 * yorum yoksa yıldız GÖSTERİLMEZ, amber "Yeni" rozeti çıkar (yıldız + "Yeni"
 * kombinasyonu değerlendirme etiketi gibi okunup yanıltıyordu).
 */
export function RatingPill({
  ratingAvg,
  ratingCount,
  showCount = false,
}: {
  ratingAvg: number;
  ratingCount: number;
  showCount?: boolean;
}) {
  if (ratingCount === 0) {
    return (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Yeni
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-1.5 py-0.5 text-sm font-semibold text-amber-700">
      <IconStar size={13} filled />
      {ratingAvg.toFixed(1)}
      {showCount && (
        <span className="text-xs font-normal text-amber-600/80">
          ({ratingCount})
        </span>
      )}
    </span>
  );
}
