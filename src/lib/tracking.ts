import { haversineKm } from "./geo";

// Durak (stay-point) tespiti sabitleri
export const STOP_RADIUS_KM = 0.05; // ~50 m: bu çapın içinde kalmak = durakta
export const STOP_MIN_SEC = 180; // gerçek durak eşiği: 3 dk altı (ışık/yavaşlama/GPS) = gürültü
export const OFFLINE_GAP_SEC = 300; // 5 dk'dan büyük ping boşluğu = şoför çevrimdışı kalmış

/**
 * BOŞLUK YUTMANIN ÜST SINIRI (2026-08-10) — canlıda ölçülen hatanın kaynağı.
 *
 * 2026-08-08'de "boşluğun iki ucu aynı noktaysa durak kesilmesin" kuralı
 * eklendi ve doğruydu: gerçek boşluklar 10-35 dakikalıktı, o süreler
 * kaydedilmiyordu. Ama kuralın ÜST SINIRI YOKTU.
 *
 * Sonuç canlıda görüldü: 8 Ağustos 19:45'te açılan durak hiç kapanmadı ve
 * `durationSec` 133.719'a (37 SAAT) çıktı — gece, mesai dışı ve telefon kapalı
 * geçen saatler "durakta" sayıldı. Üstelik durak o günün kaydı olduğu için
 * SONRAKİ günlerin raporu boş çıkıyordu: panel "gün boyu aynı bölgede kaldı"
 * derken aynı ekranda "0 durak · 0 dk" yazıyordu.
 *
 * Telefon saatlerce kapalıyken şoförün orada olduğunu BİLMİYORUZ — aynı yere
 * dönmüş de olabilir. 1 saati aşan boşlukta durak son ping'de bitirilir.
 */
export const MAX_ABSORB_GAP_SEC = 3600; // 1 saat

/**
 * BİR DURAĞIN EN UZUN SÜRESİ (2026-08-10).
 *
 * Boşluk sınırı tek başına yetmiyordu: şoför AKTİF ping atarken (boşluk yok)
 * ve çapadan hiç çıkmazken durak sonsuza kadar büyüyor. Canlıda 37 saatlik
 * "durak" böyle oluştu — dükkânın kendi bahçesinde park hâlindeki araç.
 *
 * Bir iş gününü aşan "durak" rapor olarak da anlamsız: halıcının sorusu
 * "bugün nerede ne kadar bekledi", "iki gündür orada mı" değil. 12 saati aşan
 * durak kapatılır; şoför hâlâ oradaysa bir sonraki ping yeni durak açar.
 */
export const MAX_STOP_SEC = 12 * 3600; // 12 saat

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
      // 🔴 BOŞLUK ARTIK KÖRÜ KÖRÜNE ATILMIYOR (2026-08-08).
      //
      // Eskiden her 5 dk+ boşlukta durak, SON ping anında bitiriliyordu;
      // gerekçe "uydurma uzun durak olmasın"dı. Ama boşluğun İKİ UCU AYNI
      // NOKTAYSA, şoförün orada kaldığı UYDURMA DEĞİL — veriyle sabit.
      //
      // Canlı ölçüm (2026-08-08, gerçek şoför): 5 dk'yı aşan boşlukların
      // çoğunda iki uç arasındaki mesafe 0 m'ydi (10,8 / 22,7 / 34,8 / 26,4
      // dakikalık boşluklar). Bir günde ~100 dakikalık gerçek durma süresi
      // bu yüzden hiç kaydedilmemişti — işletme sahibi haklı olarak
      // "9 dakika yazıyor ama çok daha uzun durdum" dedi.
      //
      // Yeni kural: boşluktan SONRAKİ nokta hâlâ durak çapının içindeyse
      // durak KESİLMEZ, süre boşluğu da kapsayacak şekilde uzatılır.
      // Şoför gerçekten ayrılmışsa (çapın dışına çıkmışsa) eski davranış
      // sürer — o boşlukta nerede olduğunu bilmiyoruz, saymayız.
      // ÜST SINIR: boşluk çok uzunsa (gece/mesai dışı/telefon kapalı) aynı
      // yerde olmak orada KALDIĞINI kanıtlamaz — ayrılıp dönmüş olabilir.
      const ayniYerde =
        gapSec <= MAX_ABSORB_GAP_SEC &&
        haversineKm(openStop.lat, openStop.lng, lat, lng) <= STOP_RADIUS_KM;
      if (ayniYerde) {
        return {
          type: "extend",
          durationSec: Math.round(
            (now.getTime() - openStop.startedAt.getTime()) / 1000,
          ),
        };
      }
      // Yer değiştirmiş: boşlukta nerede olduğu bilinmiyor → son ping'de bitir.
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
      // TAVAN: bir iş gününü aşan durak kapatılır (yukarıdaki MAX_STOP_SEC
      // notu). Aksi hâlde park hâlindeki araç günlerce tek "durak" olur ve
      // sonraki günlerin raporu boş çıkar — canlıda böyle oldu.
      if (durationSec > MAX_STOP_SEC) {
        return { type: "finalize", endedAt: now, durationSec: MAX_STOP_SEC };
      }
      return { type: "extend", durationSec }; // çapanın içinde → hâlâ durakta
    }
    // çapadan ayrıldı: yeterince uzun durduysa kaydet, yoksa gürültü → sil
    return durationSec >= STOP_MIN_SEC
      ? { type: "finalize", endedAt: now, durationSec }
      : { type: "discard" };
  }

  // Açık durak yok: yeni konum bir önceki ping'e yakınsa durağanlaşıyor → durak başlat.
  //
  // 🔴 2026-08-08: burada da `!offline` şartı vardı, yani 5 dk'yı aşan bir
  // boşluktan sonra durak HİÇ AÇILMIYORDU. Oysa boşluğun iki ucu aynı
  // noktaysa şoför orada beklemiş demektir — üstteki dalla aynı gerekçe.
  // Uygulamanın donduğu her sefer, o boşluk boyunca süren bekleme tamamen
  // görünmez oluyordu.
  if (
    lastPing &&
    haversineKm(lastPing.lat, lastPing.lng, lat, lng) <= STOP_RADIUS_KM
  ) {
    return { type: "open", startedAt: lastPing.recordedAt, lat, lng };
  }
  return { type: "none" };
}
