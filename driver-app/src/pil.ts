import { Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import AsyncStorage from "@react-native-async-storage/async-storage";

// PİL KISITLAMASI — şoförü ayara GÖTÜR, "Ayarlar'dan yap" deyip bırakma.
//
// NEDEN VAR (2026-08-08, sahada ölçüldü): işletme sahibinin Tecno telefonunda
// konum akışı mesai açıldıktan ~6,5 dakika sonra ÖLÜYORDU; üç ayrı oturumda
// aynı süre. Sunucu tarafı tertemizdi (her ping 200). Sebep izin değil (izin
// olmasa mesai hiç açılmazdı), `isTracking` hatası da değil (akış düzgün
// başlıyordu) — telefon ön plan servisini öldürüyordu.
//
// Tecno = Transsion/HiOS: arka plan uygulamalarını en agresif öldüren üretici
// ailesi. Bu markalarda pil muafiyetinin YANINDA ayrı bir "otomatik başlatma"
// izni de var ve ikisi farklı ekranlarda.
//
// ⚠️ DÜRÜST BEKLENTİ: muafiyet durumu İYİLEŞTİRİR, GARANTİ ETMEZ. Bazı
// üreticiler kendi sistem ayarlarını da yok sayıyor. Bu yüzden asıl güvence
// sunucudaki konum bekçisidir (src/lib/konumBekcisi.ts) — o, bu akış tutmasa
// bile ölümü şoföre ve işletmeye haber verir.

const GOSTERILDI = "pil-uyarisi-gosterildi";

/** Android'de pil optimizasyonu muafiyeti diyaloğunu doğrudan açar.
 *  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` izni manifestte olmalı, yoksa
 *  sistem isteği reddeder. */
export async function pilMuafiyetiIste(paket: string): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      { data: `package:${paket}` },
    );
    return true;
  } catch {
    // Bazı ROM'lar bu intent'i hiç taşımıyor → uygulama ayrıntı sayfasına düş.
    return uygulamaAyarlariniAc(paket);
  }
}

/** Uygulamanın kendi ayar sayfası — HiOS/MIUI/ColorOS'ta "otomatik başlatma"
 *  ve "pil" seçenekleri burada; markaya özel intent'ler güvenilmez olduğu için
 *  standart olan bu sayfaya götürüyoruz. */
export async function uygulamaAyarlariniAc(paket: string): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.APPLICATION_DETAILS_SETTINGS",
      { data: `package:${paket}` },
    );
    return true;
  } catch {
    return false;
  }
}

/** Uyarı bu kurulumda daha önce gösterildi mi? (Her mesaide tekrarlamayalım —
 *  4.69'daki "sürekli aynı metni okutma" dersi.) */
export async function pilUyarisiGosterildiMi(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(GOSTERILDI)) === "1";
  } catch {
    return false;
  }
}

export async function pilUyarisiniIsaretle(): Promise<void> {
  try {
    await AsyncStorage.setItem(GOSTERILDI, "1");
  } catch {
    // işaret yazılamazsa en kötü ihtimalle uyarı bir kez daha çıkar
  }
}
