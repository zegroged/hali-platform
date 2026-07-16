import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { postLocation } from "./api";

export const LOCATION_TASK = "hali-driver-location";

// Web DriverShift ile AYNI gönderim süzgeci: 25 m'den az hareket VE son
// gönderim 60 sn'den yeniyse atla. Duran şoför yine de dakikada bir
// "buradayım" der — panelde çevrimdışı düşmez, durak tespiti beslenir.
let lastSent: { lat: number; lng: number; t: number } | null = null;

function movedMeters(a: { lat: number; lng: number }, lat: number, lng: number) {
  const R = 6371000;
  const dLat = ((lat - a.lat) * Math.PI) / 180;
  const dLng = ((lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Arka plan konum görevi — uygulama kapalı/kilitliyken bile çalışır (native).
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locs = (data as { locations?: Location.LocationObject[] })?.locations;
  const loc = locs?.[locs.length - 1];
  if (!loc) return;
  const { latitude, longitude, accuracy } = loc.coords;
  // KAYMA SÜZGECİ (webdeki DriverShift ile aynı eşik): GPS oturmadan gelen
  // kaba fix yüzlerce metre sapar — hiç gönderme, sonraki fix'i bekle.
  if (accuracy != null && accuracy > 150) return;
  const now = Date.now();
  if (
    lastSent &&
    movedMeters(lastSent, latitude, longitude) < 25 &&
    now - lastSent.t < 60_000
  ) {
    return;
  }
  lastSent = { lat: latitude, lng: longitude, t: now };
  try {
    const result = await postLocation(latitude, longitude, accuracy ?? undefined);
    // Oturum düştüyse izlemeyi durdur — "Mesaidesin" bildirimi asılı kalmasın,
    // boşuna GPS/pil yakmasın (şoför açınca tekrar giriş yapar).
    if (result === "unauthorized") await stopTracking();
    // Baz istasyonu geçişi vb. anlık ağ kopmasında gönderim düştüyse, 60 sn
    // süzgecini beklemeden bir SONRAKİ fix'te (≤15 sn) hemen yeniden dene.
    if (result === "failed") lastSent = null;
  } catch {
    // ağ hatasında sessizce geç; sonraki konumda tekrar denenir
    lastSent = null;
  }
});

export async function startTracking(): Promise<string | null> {
  // ÖNEMLİ (Google Play politikası): bu fonksiyon çağrılmadan ÖNCE kullanıcıya
  // "belirgin açıklama" (prominent disclosure) gösterilip onay alınmış olmalı —
  // App.tsx toggleShift bunu yapar. İzin isteği onaydan önce ASLA tetiklenmemeli.
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return "Konum izni gerekli.";
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    return "Arka plan için 'Her zaman izin ver' seçilmeli (Ayarlar > Konum).";
  }

  const already = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (already) return null;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    // Balanced (~100 m, Wi-Fi/baz) sürüş takibi için kaba — haritada kayma
    // yapıyordu. High = gerçek GPS (~10 m); mesai saatinde pil maliyeti kabul.
    accuracy: Location.Accuracy.High,
    // distanceInterval 25 idi — duran cihaz HİÇ güncelleme üretmiyordu, şoför
    // 5 dk sonra panelde "çevrimdışı" görünüyordu. 0 + 15 sn: sistem düzenli
    // güncelleme verir, gönderimi yukarıdaki süzgeç (25 m / 60 sn) kısar.
    distanceInterval: 0,
    timeInterval: 15000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Mesaidesin",
      notificationBody: "Konumun halıcına iletiliyor.",
    },
  });
  return null;
}

export async function stopTracking() {
  if (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

export async function isTracking() {
  return TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
}
