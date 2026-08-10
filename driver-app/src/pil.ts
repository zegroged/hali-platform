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

/** Şoförün "muafiyeti verdim" beyanı. */
const PIL_BEYAN = "pil-muafiyeti-verildi";

/**
 * "YAPTIM DİYORUM, YİNE SORUYOR" — 2026-08-10.
 *
 * Şikâyet haklıydı: pil adımı HER AÇILIŞTA "yap" diyordu, çünkü şoförün
 * verdiği cevap hiçbir yere yazılmıyordu. Sorulan soru ("Ekran açıldı mı?")
 * yalnız o anlık bir uyarıydı; ekran durumu ise sabit "yapılmadı"ydı.
 *
 * ⚠️ NEDEN GERÇEK DENETLEYİCİ YOK: Android muafiyet durumunu
 * (`PowerManager.isIgnoringBatteryOptimizations`) uygulamaya ancak native
 * kod üzerinden verir; Expo'nun hazır modüllerinde karşılığı yok.
 * `react-native-device-info` denendi — o API'yi TAŞIMIYOR, bağımlılık geri
 * alındı. Uydurma bir kontrol yazmaktansa şoförün beyanını kalıcı kılıyoruz
 * ve ASIL KANITI ayrı gösteriyoruz: konum gerçekten akıyor mu
 * (`sonKonumGonderimi`). Beyan "sormayı kesmek" içindir, kanıt yerine geçmez.
 */
export async function pilBeyaniVarMi(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PIL_BEYAN)) === "1";
  } catch {
    return false;
  }
}

export async function pilBeyaniniKaydet(verildi: boolean): Promise<void> {
  try {
    if (verildi) await AsyncStorage.setItem(PIL_BEYAN, "1");
    else await AsyncStorage.removeItem(PIL_BEYAN);
  } catch {
    // yazılamazsa yalnız "bir daha sorma" özelliği kaybolur, akış bozulmaz
  }
}

/** Android'de pil optimizasyonu muafiyeti diyaloğunu doğrudan açar.
 *
 *  ⚠️ 2026-08-08 — SESSİZ BAŞARISIZLIK BURADAYDI: bu çağrı Tecno/HiOS'ta
 *  HATA ATMADAN dönüyor ama ekranda hiçbir şey açılmıyor. Eski sürüm bunu
 *  "başarılı" sayıp susuyordu; işletme sahibi "düğme çalışmıyor" dedi ve
 *  haklıydı. Artık ÇAĞIRAN, açılıp açılmadığını KULLANICIYA sormak zorunda
 *  (bkz. App.tsx pil akışı) — çünkü Android bunu programatik olarak
 *  söylemiyor: muafiyet durumunu okumanın Expo'da bir yolu yok.
 *
 *  🔑 Ve şunu bilerek yapmıyoruz: uygulamanın kendini muaf tutması Android'de
 *  MÜMKÜN DEĞİL. Sistem diyaloğunu kullanıcı onaylamak zorunda; bu kasıtlı
 *  bir platform kuralı. Otomatik kaldırma isteği bu yüzden karşılanamaz. */
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

/** Telefonun KONUM ayarları ekranı (GPS anahtarının bulunduğu yer).
 *  İzin ekranından farklı: izin verilmiş olsa bile bu anahtar kapalıysa
 *  hiçbir konum üretilmez. */
export async function konumAyarlariniAc(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.LOCATION_SOURCE_SETTINGS",
    );
    return true;
  } catch {
    return false;
  }
}

/** Pil optimizasyonu AYARLAR LİSTESİ — "Kısıtlanmamış" seçeneğinin bulunduğu
 *  ekran. Doğrudan diyalog açılmadığında güvenilir ikinci yol; bu intent
 *  neredeyse tüm ROM'larda var. */
export async function pilAyarListesiniAc(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS",
    );
    return true;
  } catch {
    return false;
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
