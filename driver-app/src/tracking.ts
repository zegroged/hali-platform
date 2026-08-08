import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { postLocation } from "./api";
import { checkNewOrdersAndNotify } from "./notify";
import {
  durumuOku,
  durumuYaz,
  durumuSifirla,
  sonGonderimiOku,
} from "./izlemeDurumu";

export const LOCATION_TASK = "hali-driver-location";

// Web DriverShift ile AYNI gönderim süzgeci: 25 m'den az hareket VE son
// gönderim 60 sn'den yeniyse atla. Duran şoför yine de dakikada bir
// "buradayım" der — panelde çevrimdışı düşmez, durak tespiti beslenir.
//
// 🔴 2026-08-08: Bu süzgecin ve altındaki demirlemenin durumu artık BELLEKTE
// DEĞİL, kalıcı depoda tutuluyor (src/izlemeDurumu.ts). Modül değişkenleri
// arka plan görevinin headless bağlamı yıkılınca sıfırlanıyordu ve bütün
// frenler devre dışı kalıyordu — gerekçe ve canlı ölçüm o dosyanın başında.

/**
 * SON BAŞARILI GÖNDERİM ANI — ekranda gösterilir (2026-08-07 gecesi).
 * Konum akışının ölü olması bugüne kadar HİÇBİR YERDE görünmüyordu; şoför
 * "mesaideyim" sanıyor, halıcı boş harita görüyordu. Artık uygulama
 * "konum gönderilemiyor" diyebiliyor (App.tsx).
 *
 * ⚠️ 2026-08-08'de ASENKRON oldu: değer kalıcı depodan okunuyor. Eskiden
 * modül değişkeniydi ve bağlam yıkılınca 0'a düşüyordu — ekran konum
 * GİDERKEN "henüz gönderilemedi" diyebiliyordu (göstergenin kendisi yalan).
 */
export async function sonKonumGonderimi(): Promise<number> {
  return sonGonderimiOku();
}

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

// Arka plan konum görevi — uygulama kapalı/kilitliyken bile çalışır (native).
//
// ⚠️ BU GÖVDENİN TÜM DURUMU KALICI DEPODAN GELİR (izlemeDurumu.ts). Modül
// değişkeni KULLANMA: bu görev headless bağlamda çalışır, bağlam çağrılar
// arasında yıkılabilir ya da aynı anda birden fazla kopya koşabilir. Buraya
// `let` bir fren koyan, 2026-08-08'de ölçülen hatayı geri getirir.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locs = (data as { locations?: Location.LocationObject[] })?.locations;
  const loc = locs?.[locs.length - 1];
  if (!loc) return;

  const st = await durumuOku();

  // YENİ İŞ BİLDİRİMİ: konum süzgeçlerinden ÖNCE (duran/kaba-konumlu şoför de
  // yeni işten haberdar olmalı). Mesai açıkken ~45 sn'de bir yoklar.
  const simdi = Date.now();
  if (simdi - st.lastOrderCheck > 45_000) {
    st.lastOrderCheck = simdi;
    // Yoklama İSTEĞİNDEN ÖNCE yaz: eşzamanlı ikinci bir çağrı aynı anda
    // girip aynı bildirimi bir daha üretmesin (canlıda 2 saniyede 6 istek
    // görüldü — hepsi aynı işi yapıyordu).
    await durumuYaz(st);
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
  if (st.durum === "DURUYOR") {
    if (!st.demir) st.demir = { lat: latitude, lng: longitude };
    const uzaklik = movedMeters(st.demir, latitude, longitude);
    st.uzakArdisik = uzaklik > DEMIR_ESIK_M ? st.uzakArdisik + 1 : 0;
    // Cihazın kendi hız ölçümü konumdan bağımsızdır: park hâlindeki telefonun
    // fix'i zıplasa da hız ~0 kalır. O yüzden hıza anında güveniyoruz.
    const hizVar = speed != null && speed >= HIZ_ESIK_MS;
    if (hizVar || st.uzakArdisik >= ONAY_ARDISIK) {
      st.durum = "HAREKETTE";
      st.uzakArdisik = 0;
      st.demir = null;
      st.sonHareketAt = now;
    } else {
      gonderLat = st.demir.lat;
      gonderLng = st.demir.lng;
    }
  }
  if (st.durum === "HAREKETTE") {
    if (!st.lastSent || movedMeters(st.lastSent, latitude, longitude) >= 25) {
      st.sonHareketAt = now;
    } else if (now - st.sonHareketAt > DURMA_SURESI_MS) {
      // 90 sn'dir kıpırdamıyor → yeniden demirle. Bundan sonraki titremeler
      // ve yavaş sürüklenmeler gönderilmez.
      st.durum = "DURUYOR";
      st.uzakArdisik = 0;
      st.demir = { lat: latitude, lng: longitude };
      gonderLat = st.demir.lat;
      gonderLng = st.demir.lng;
    }
  }

  if (
    st.lastSent &&
    movedMeters(st.lastSent, gonderLat, gonderLng) < 25 &&
    now - st.lastSent.t < 60_000
  ) {
    // Süzgeç tuttu: gönderme YOK ama demirleme/durum değişmiş olabilir — yaz.
    await durumuYaz(st);
    return;
  }
  st.lastSent = { lat: gonderLat, lng: gonderLng, t: now };
  // GÖNDERİMDEN ÖNCE yaz: istek uzun sürerse (yavaş şebeke) bu arada uyanan
  // ikinci bir çağrı aynı noktayı bir daha göndermesin.
  await durumuYaz(st);
  try {
    const result = await postLocation(gonderLat, gonderLng, accuracy ?? undefined);
    if (result === "ok") st.sonGonderimAt = Date.now();
    // Oturum düştüyse izlemeyi durdur — "Mesaidesin" bildirimi asılı kalmasın,
    // boşuna GPS/pil yakmasın (şoför açınca tekrar giriş yapar).
    if (result === "unauthorized") await stopTracking();
    // Baz istasyonu geçişi vb. anlık ağ kopmasında gönderim düştüyse, 60 sn
    // süzgecini beklemeden bir SONRAKİ fix'te hemen yeniden dene.
    if (result === "failed") st.lastSent = null;
    await durumuYaz(st);
  } catch {
    // ağ hatasında sessizce geç; sonraki konumda tekrar denenir
    st.lastSent = null;
    await durumuYaz(st);
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

  // 🔴 EN PAHALI HATA (2026-08-07 gecesi — canlıda ölçülerek bulundu).
  //
  // BURADA ŞU VARDI:
  //   const already = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  //   if (already) return null;
  //
  // `isTaskRegisteredAsync` görevin TANIMLI olduğunu söyler; konum
  // güncellemelerinin AKTIĞINI söylemez. Telefon yeniden başlatıldığında,
  // uygulama zorla kapatıldığında ya da sistem servisi geri aldığında görev
  // "kayıtlı" kalır ama akış ölür. O hâlde şoför mesaiyi açar, bu satır
  // `return null` der, `startLocationUpdatesAsync` HİÇ ÇAĞRILMAZ ve TEK BİR
  // KONUM GİTMEZ — üstelik hiçbir hata görünmez.
  //
  // ÖLÇÜM (canlı, 2026-08-07): uygulama çalışıyor ve sipariş çekiyordu
  // (2 saatte 33 × GET /api/driver/orders, okhttp), `POST /api/driver/location`
  // ise **SIFIR**. İşletme sahibi "1 saattir mesaideydim, gittiğim yol
  // işletmeye gitmemiş" dedi — sebebi buydu.
  //
  // ÇÖZÜM: doğru soru "kayıtlı mı" değil, "AKIYOR MU" —
  // `hasStartedLocationUpdatesAsync`. Akıyorsa bile mesai açılışında
  // durdurup yeniden başlatıyoruz: seçenekler (sıklık/hassasiyet) tazelenir
  // ve yarım kalmış bir akış varsa temizlenir. Bu çağrı ucuzdur, mesaide
  // günde birkaç kez olur.
  try {
    const akiyor = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (akiyor) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    // Okunamazsa yine de başlatmayı dene — sessiz kalmaktan iyidir.
  }

  // Yeni mesai = temiz sayfa: dünkü çıpa bugüne taşınırsa şoför işe
  // başladığında ilk konumlar eski park yerine gönderilir.
  await durumuSifirla();

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

/** Konum AKIYOR mu?
 *
 *  🔴 md.8(a) — 2026-08-08'de düzeltildi. Burada `isTaskRegisteredAsync` vardı:
 *  görevin TANIMLI olduğunu söyler, aktığını söylemez (aynı tuzak 4.75a'da
 *  `startTracking` içinde de vardı, düzeltme oraya konup buraya konmamıştı).
 *  Sonucu: telefon görevi öldürdüğünde uygulama açılışta hâlâ "Mesaidesin —
 *  konum paylaşılıyor" yazıyordu. Akış ölüyken YEŞİL gösteren bir ekran,
 *  hiç göstergesi olmamasından kötüdür. */
export async function isTracking() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}
