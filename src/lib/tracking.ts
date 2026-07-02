import { haversineKm } from "./geo";

// Durak (stay-point) tespiti sabitleri
export const STOP_RADIUS_KM = 0.05; // ~50 m: bu çapın içinde kalmak = durakta
export const STOP_MIN_SEC = 180; // gerçek durak eşiği: 3 dk altı (ışık/yavaşlama/GPS) = gürültü
export const OFFLINE_GAP_SEC = 300; // 5 dk'dan büyük ping boşluğu = şoför çevrimdışı kalmış

export type StopAction =
  | { type: "none" } // hareket halinde, bir şey yapma
  | { type: "open"; startedAt: Date; lat: number; lng: number } // durak başlat
  | { type: "extend"; durationSec: number } // süreyi uzat
  | { type: "finalize"; endedAt: Date; durationSec: number } // gerçek durağı kaydet
  | { type: "discard" }; // çok kısa → sil

// Yeni konum geldiğinde ne yapılacağını belirler. Saf/deterministik (test edilebilir).
export function evaluateStop(args: {
  openStop: { lat: number; lng: number; startedAt: Date } | null;
  lastPing: { lat: number; lng: number; recordedAt: Date } | null;
  lat: number;
  lng: number;
  now: Date;
}): StopAction {
  const { openStop, lastPing, lat, lng, now } = args;

  // Son ping ile şimdi arasında büyük boşluk = şoför çevrimdışı kalmış.
  // Bu boşluk durak süresine KATILMAMALI (uydurma uzun durak olmasın).
  const gapSec = lastPing
    ? (now.getTime() - lastPing.recordedAt.getTime()) / 1000
    : Infinity;
  const offline = gapSec > OFFLINE_GAP_SEC;

  if (openStop) {
    if (offline) {
      // Açık durağı SON ping anında bitir; boşluğu sayma.
      const durationSec = lastPing
        ? Math.round(
            (lastPing.recordedAt.getTime() - openStop.startedAt.getTime()) / 1000,
          )
        : 0;
      return durationSec >= STOP_MIN_SEC
        ? { type: "finalize", endedAt: lastPing!.recordedAt, durationSec }
        : { type: "discard" };
    }

    const durationSec = Math.round(
      (now.getTime() - openStop.startedAt.getTime()) / 1000,
    );
    const dist = haversineKm(openStop.lat, openStop.lng, lat, lng);
    if (dist <= STOP_RADIUS_KM) {
      return { type: "extend", durationSec }; // çapanın içinde → hâlâ durakta
    }
    // çapadan ayrıldı: yeterince uzun durduysa kaydet, yoksa gürültü → sil
    return durationSec >= STOP_MIN_SEC
      ? { type: "finalize", endedAt: now, durationSec }
      : { type: "discard" };
  }

  // Açık durak yok: yeni konum bir önceki (yakın zamanlı) ping'e yakınsa durağanlaşıyor → durak başlat.
  // Çevrimdışı boşluktan sonra "yakınlık" anlamsız olur, bu yüzden offline ise açma.
  if (
    lastPing &&
    !offline &&
    haversineKm(lastPing.lat, lastPing.lng, lat, lng) <= STOP_RADIUS_KM
  ) {
    return { type: "open", startedAt: lastPing.recordedAt, lat, lng };
  }
  return { type: "none" };
}
