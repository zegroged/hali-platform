import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { postLocation } from "./api";
import { checkNewOrdersAndNotify } from "./notify";

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

// ───────────────────────────────────────────────────────────────────────────
// 🔴 DEMİRLEME (2026-08-07 akşam) — sapmış konum SUNUCUYA HİÇ GİTMESİN.
//
// İKİZ MANTIK: web `src/components/DriverShift.tsx` — birini değiştiren
// ötekini de değiştirmeli (DEVIR §7 "İKİZ mantıklar").
//
// NEDEN: bugüne kadar tek savunma çizim anındaki süzgeçti
// (`src/lib/konumFiltre.ts`). O süzgeç iyi çalışıyor ama iki dürüst boşluğu
// vardı (DEVIR §5-B/2). Asıl çözüm gürültüyü KAYNAKTA kesmek: park hâlindeki
// telefon, hareket etmediği hâlde 300 m sapan fix üretir; bunu göndermezsek
// ne veritabanına girer, ne haritaya, ne durak hesabına, ne de müşterinin
// gördüğü "kurye nerede" işaretçisine.
//
// İKİ DURUMLU MAKİNE (histerezis) — tek eşikli süzgeç titrer, iki eşik gerek:
//
//   DURUYOR   : bir ÇIPA (demir) noktası vardır. Çıpaya 60 m'den yakın her
//               fix "aynı yer" sayılır; gönderilen konum FIX DEĞİL ÇIPADIR.
//               Böylece 60 m altındaki yavaş sürüklenme hiç kaydolmaz.
//               Çıpa ancak iki şeyden biriyle bırakılır:
//                 · cihazın kendi HIZ ölçümü ≥ 1,5 m/sn (GPS Doppler'ı —
//                   sürüş başladığında anında ve güvenilir haber verir), ya da
//                   ⚠️ Doppler hızı, konum sapmasından BAĞIMSIZ ölçülür;
//                   duran telefonda fix 300 m zıplasa bile hız ~0 kalır.
//                 · ÜST ÜSTE İKİ fix'in 60 m'den uzak düşmesi (tek sapmış
//                   fix çıpayı kıramaz — sapmaların çoğu tektir).
//   HAREKETTE : normal gönderim (25 m / 60 sn süzgeci). 90 sn boyunca 25 m'yi
//               aşan hareket olmazsa yeniden demirlenir.
//
// DÜRÜST SINIR: üst üste İKİ+ sapmış fix çıpayı kırabilir. O durumda araç
// birkaç nokta boyunca yanlış yerde görünür, sonra geri döner — çizim
// tarafındaki "sivri demeti ayıklama" (1..3 nokta) bunu haritadan siler.
// İki katman birbirini tamamlıyor: kaynak tekleri ve sürüklenmeyi, çizim
// demetleri kesiyor.
const DEMIR_ESIK_M = 60; // çıpadan bu kadar uzaklaşmadan hareket sayılmaz
const HIZ_ESIK_MS = 1.5; // ≈5,4 km/sa — cihaz "gidiyorum" diyorsa anında inan
const ONAY_ARDISIK = 2; // hız yoksa: üst üste kaç uzak fix hareket sayılır
const DURMA_SURESI_MS = 90_000; // hareketsiz geçen bu süre sonunda yeniden demirle

type Durum = "DURUYOR" | "HAREKETTE";
let durum: Durum = "DURUYOR";
let demir: { lat: number; lng: number } | null = null;
let uzakArdisik = 0;
let sonHareketAt = 0;

// Arka plan konum görevi — uygulama kapalı/kilitliyken bile çalışır (native).
// Yeni-iş yoklaması için ayrı sayaç: konum 15 sn'de bir gelir ama sipariş
// listesini her seferinde çekmek israf — 45 sn'de bir yeter.
let lastOrderCheck = 0;

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locs = (data as { locations?: Location.LocationObject[] })?.locations;
  const loc = locs?.[locs.length - 1];
  if (!loc) return;
  // YENİ İŞ BİLDİRİMİ: konum süzgeçlerinden ÖNCE (duran/kaba-konumlu şoför de
  // yeni işten haberdar olmalı). Mesai açıkken ~45 sn'de bir yoklar.
  const simdi = Date.now();
  if (simdi - lastOrderCheck > 45_000) {
    lastOrderCheck = simdi;
    await checkNewOrdersAndNotify();
  }
  const { latitude, longitude, accuracy, speed } = loc.coords;
  // KAYMA SÜZGECİ (webdeki DriverShift ile aynı eşik): GPS oturmadan gelen
  // kaba fix yüzlerce metre sapar — hiç gönderme, sonraki fix'i bekle.
  if (accuracy != null && accuracy > 150) return;
  const now = Date.now();

  // DEMİRLEME (yukarıdaki blok): duruyorsak fix'i değil ÇIPAYI bildiririz.
  let gonderLat = latitude;
  let gonderLng = longitude;
  if (durum === "DURUYOR") {
    if (!demir) demir = { lat: latitude, lng: longitude };
    const uzaklik = movedMeters(demir, latitude, longitude);
    uzakArdisik = uzaklik > DEMIR_ESIK_M ? uzakArdisik + 1 : 0;
    // Cihazın kendi hız ölçümü konumdan bağımsızdır: park hâlindeki telefonun
    // fix'i zıplasa da hız ~0 kalır. O yüzden hıza anında güveniyoruz.
    const hizVar = speed != null && speed >= HIZ_ESIK_MS;
    if (hizVar || uzakArdisik >= ONAY_ARDISIK) {
      durum = "HAREKETTE";
      uzakArdisik = 0;
      demir = null;
      sonHareketAt = now;
    } else {
      gonderLat = demir.lat;
      gonderLng = demir.lng;
    }
  }
  if (durum === "HAREKETTE") {
    if (!lastSent || movedMeters(lastSent, latitude, longitude) >= 25) {
      sonHareketAt = now;
    } else if (now - sonHareketAt > DURMA_SURESI_MS) {
      // 90 sn'dir kıpırdamıyor → yeniden demirle. Bundan sonraki titremeler
      // ve yavaş sürüklenmeler gönderilmez.
      durum = "DURUYOR";
      uzakArdisik = 0;
      demir = { lat: latitude, lng: longitude };
      gonderLat = demir.lat;
      gonderLng = demir.lng;
    }
  }

  if (
    lastSent &&
    movedMeters(lastSent, gonderLat, gonderLng) < 25 &&
    now - lastSent.t < 60_000
  ) {
    return;
  }
  lastSent = { lat: gonderLat, lng: gonderLng, t: now };
  try {
    const result = await postLocation(gonderLat, gonderLng, accuracy ?? undefined);
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

/**
 * Arka plan konum izni ZATEN verilmiş mi? (İzin İSTEMEZ, yalnız sorar.)
 *
 * NEDEN: "belirgin açıklama" ekranı her mesai açılışında çıkıyordu ve şoförü
 * gereksiz yere yoruyordu (2026-08-06 kullanıcı geri bildirimi). Play'in kuralı
 * açıklamanın izin İSTEĞİNDEN ÖNCE gösterilmesi; izin zaten verilmişse yeni
 * istek olmadığı için açıklamayı tekrarlamak gerekmiyor. App.tsx bunu sorup
 * karar veriyor.
 */
export async function konumIzniVarMi(): Promise<boolean> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return false;
    const bg = await Location.getBackgroundPermissionsAsync();
    return bg.status === "granted";
  } catch {
    return false;
  }
}

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

  // Yeni mesai = temiz sayfa: dünkü çıpa bugüne taşınırsa şoför işe
  // başladığında ilk konumlar eski park yerine gönderilir.
  durum = "DURUYOR";
  demir = null;
  uzakArdisik = 0;
  lastSent = null;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    // Balanced (~100 m, Wi-Fi/baz) sürüş takibi için kaba — haritada kayma
    // yapıyordu. High = gerçek GPS (~10 m); mesai saatinde pil maliyeti kabul.
    accuracy: Location.Accuracy.High,
    // distanceInterval 25 idi — duran cihaz HİÇ güncelleme üretmiyordu, şoför
    // 5 dk sonra panelde "çevrimdışı" görünüyordu. 0 + 15 sn: sistem düzenli
    // güncelleme verir, gönderimi yukarıdaki süzgeç (25 m / 60 sn) kısar.
    distanceInterval: 0,
    // ÖRNEKLEME SIKLIĞI 15 sn → 5 sn (2026-08-06, kullanıcı kararı).
    // Hareket hâlinde çözünürlük artar: 50 km/sa'te 200 m yerine ~70 m'de bir
    // nokta. Sık örnek, sivri ayıklamanın (lib/konumFiltre.ts) doğru
    // çalışması için de gerekli — seyrek veride aykırı nokta ile gerçek
    // hareket ayırt edilemiyor.
    // ⚠️ DURAN şoför yine 60 sn'de bir gönderiyor (aşağıdaki 25 m / 60 sn
    // freni) — boşuna veri ve pil yakılmıyor.
    timeInterval: 5000,
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
