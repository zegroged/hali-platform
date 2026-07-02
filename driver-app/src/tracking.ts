import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { postLocation } from "./api";

export const LOCATION_TASK = "hali-driver-location";

// Arka plan konum görevi — uygulama kapalı/kilitliyken bile çalışır (native).
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locs = (data as { locations?: Location.LocationObject[] })?.locations;
  const loc = locs?.[locs.length - 1];
  if (!loc) return;
  try {
    await postLocation(loc.coords.latitude, loc.coords.longitude);
  } catch {
    // ağ hatasında sessizce geç; sonraki konumda tekrar denenir
  }
});

export async function startTracking(): Promise<string | null> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return "Konum izni gerekli.";
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    return "Arka plan için 'Her zaman izin ver' seçilmeli (Ayarlar > Konum).";
  }

  const already = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (already) return null;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 25, // en az 25 m hareket
    timeInterval: 8000, // ya da 8 sn
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
