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
  // "YENİ" ROZETİ KALDIRILDI (2026-08-04, kullanıcı kararı).
  // Canlıda 35 işletmenin neredeyse hepsinde yorum yok → rozet HER kartta
  // çıkıyordu. Her şeyin "yeni" olduğu bir vitrin, siteyi dün kurulmuş
  // gösteriyor ve güveni düşürüyor ("dolandırıcı gibi duruyor" geri bildirimi).
  // Puan yoksa artık hiçbir şey yazmıyoruz — yokluk, kötü bir etiketten iyidir.
  if (ratingCount === 0) return null;
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
