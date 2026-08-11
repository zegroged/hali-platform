import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listOrders, API_BASE, getToken } from "./api";

// MESAİDE YEREL BİLDİRİM: FCM/Firebase kurulumu olmadan "yeni iş" bildirimi.
// Şoför mesaideyken konum görevi zaten ~15 sn'de bir uyanıyor — o kanaldan
// atanmış işler yoklanır, daha önce bildirilmemiş YENİ (CREATED) iş varsa
// yerel bildirim basılır. Mesai dışı bildirim = gerçek push (FCM), sonraki iş.

// Uygulama ön plandayken de bildirim görünsün (varsayılan sessizce yutar).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const SEEN_KEY = "hali-bildirilen-isler";

/** Android 13+ çalışma zamanı bildirim izni (mesai başlarken istenir). */
export async function ensureNotifPermission(): Promise<boolean> {
  try {
    const mevcut = await Notifications.getPermissionsAsync();
    if (mevcut.granted) return true;
    const yeni = await Notifications.requestPermissionsAsync();
    return yeni.granted;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// SUNUCUDAN PUSH (2026-08-05, kullanıcı kararı: "uygulama zaten mühim, bildirim
// versin"). Yukarıdaki yerel yoklama YALNIZ şoför mesaideyken ve uygulama
// çalışırken iş görüyordu. İşletme sahibi için hiç yoktu: uygulama kapalıysa
// yeni siparişten haberi olmuyordu. Artık sunucu `notify()` her çağrıldığında
// bu jetona push atıyor — uygulama kapalıyken bile telefon çalar.
//
// ⚠️ ANDROID'DE FCM ŞART: `google-services.json` ve EAS'te FCM anahtarı yoksa
// jeton alınamaz. O durumda burada sessizce vazgeçiyoruz (uygulama açılmaya
// devam etsin), sebebi log'a düşer.
// ---------------------------------------------------------------------------

/** Android bildirim kanalı — sunucu `channelId: "default"` gönderiyor. */
async function kanalKur(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Bildirimler",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0f766e",
    });
  } catch (e) {
    console.warn("[push] kanal kurulamadı:", e);
  }
}

/** Cihaz jetonunu al ve sunucuya kaydet. Giriş yapıldıktan SONRA çağrılır. */
export async function pushKaydet(): Promise<void> {
  try {
    // Emülatörde push jetonu alınamaz; gerçek cihaz şart.
    if (!Device.isDevice) return;
    if (!(await ensureNotifPermission())) return;
    await kanalKur();

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn("[push] projectId bulunamadı — jeton alınamaz");
      return;
    }
    const { data: jeton } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (!jeton) return;

    const oturum = await getToken();
    if (!oturum) return;
    const res = await fetch(`${API_BASE}/api/push/kayit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${oturum}`,
      },
      body: JSON.stringify({ token: jeton, platform: Platform.OS }),
    });
    if (!res.ok) console.warn("[push] jeton kaydedilemedi:", res.status);
  } catch (e) {
    // FCM kurulu değilse burası patlar — uygulamayı durdurma.
    console.warn("[push] jeton alınamadı (FCM kurulu mu?):", e);
  }
}

/** Çıkışta jetonu sunucudan düşür — telefon el değiştirirse bildirim gitmesin. */
export async function pushSil(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: jeton } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const oturum = await getToken();
    if (!jeton || !oturum) return;
    await fetch(`${API_BASE}/api/push/kayit`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${oturum}`,
      },
      body: JSON.stringify({ token: jeton }),
    });
  } catch {
    // önemsiz — jeton zaten geçersizleşecek
  }
}

/** Atanmış işleri yoklar; bildirilmemiş yeni talep varsa yerel bildirim basar.
 *  Ağ hatasında sessizce geçer (sonraki yoklama dener). */
export async function checkNewOrdersAndNotify(): Promise<void> {
  try {
    const isler = await listOrders();
    const yeniTalepler = isler.filter((o) => o.status === "CREATED");
    if (!yeniTalepler.length) return;

    const kayit = (await AsyncStorage.getItem(SEEN_KEY)) ?? "[]";
    const bildirilen: string[] = JSON.parse(kayit);
    const bildirilecek = yeniTalepler.filter((o) => !bildirilen.includes(o.id));
    if (!bildirilecek.length) return;

    for (const o of bildirilecek.slice(0, 3)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Yeni iş atandı! 🧺",
          body: `${o.customerName} · ${o.pickupAddress.slice(0, 60)}`,
        },
        trigger: null, // hemen göster
      });
    }
    const guncel = [...bildirilen, ...bildirilecek.map((o) => o.id)].slice(-100);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(guncel));
  } catch {
    // sonraki yoklamada tekrar denenir
  }
}

// ── UYANDIRMA: SUNUCU PUSH'UYLA KONUM AKIŞINI DİRİLT (2026-08-10) ──────────
//
// NEDEN VAR: Transsion/HiOS gibi ROM'lar foreground service'i bile öldürüyor
// (canlı ölçüm: ~6,5 dk). Öldürülen servisi uygulama KENDİ BAŞINA diriltemez —
// çalışan kodu kalmaz. Dışarıdan bir tetik şart, o tetik push'tur.
//
// Sunucu tarafı: `lib/konumBekcisi.ts` mesai açıkken 10 dk ping gelmezse
// `{ tip: "konum-yeniden-baslat" }` verisiyle YÜKSEK ÖNCELİKLİ bildirim yollar.
//
// İKİ YOL BİRDEN, çünkü hangisinin çalışacağı ROM'a bağlı:
//  1. Süreç ayaktaysa bildirim GELİR GELMEZ akış yeniden başlar — şoför
//     hiçbir şey yapmaz, çoğu zaman farkına bile varmaz.
//  2. Süreç öldürülmüşse bildirim ekranda durur; şoför DOKUNUNCA uygulama
//     açılır ve aynı akış işler.
//
// ⚠️ GARANTİ DEĞİL: ROM push'u da geciktirebilir. Bu bir olasılık artırıcıdır,
// "kusursuz süreklilik" değil — ürün metinlerinde öyle anlatılmamalı.
import { startTracking, isTracking, stopTracking } from "./tracking";
import { sonGonderimiOku } from "./izlemeDurumu";

/** Akış bu süredir hiç veri göndermediyse "ölü" sayılır ve zorla diriltilir.
 *  180 sn: duran şoför bile 60 saniyede bir kalp atışı gönderiyor (tracking.ts),
 *  yani 3 kaçmış atış. Geçici şebeke kesintisine takılmaz. */
const OLU_ESIK_MS = 180_000;

/** Bildirim verisi bu tipi taşıyorsa konum akışı yeniden başlatılır. */
const YENIDEN_BASLAT = "konum-yeniden-baslat";

function tipiOku(veri: unknown): string | null {
  if (!veri || typeof veri !== "object") return null;
  const t = (veri as Record<string, unknown>).tip;
  return typeof t === "string" ? t : null;
}

async function konumuDirilt(kaynak: string): Promise<void> {
  try {
    // 🔴 CANLILIK ARTIK "KAYITLI MI" DEĞİL "AKIYOR MU" (2026-08-11).
    //
    // ESKİSİ: `if (await isTracking()) return;`
    // `isTracking()` = `Location.hasStartedLocationUpdatesAsync()` ve bu API
    // yalnızca GÖREV KAYITLI MI der. HiOS'un yaptığı şey tam olarak servisi
    // KAYITLI BIRAKIP JS'i dondurmak: o hâlde `isTracking()` true döner, akış
    // ölüdür ve bu satır uyandırmayı ÇÖPE ATAR. Sunucunun gönderdiği kurtarma
    // push'u hiçbir şey yapmadan geri dönerdi — şoför bildirime DOKUNSA BİLE.
    // Canlıda ölçüldü (2026-08-10): tek günde 12 delik, ikisi 109 ve 114 dakika.
    //
    // Doğru soru: "en son ne zaman veri GİTTİ?" — o damga zaten tutuluyor.
    // Bayatsa görev yıkılıp yeniden kuruluyor; kayıtlı bir zombi görevi
    // yeniden başlatmak tek başına yetmez, önce SÖKMEK gerekir.
    //
    // KURAL 1 (DEVIR §4.87-D): canlılık çağrının dönüşünden değil, zaman
    // damgalı gözlenen etkiden okunur.
    const sonGonderim = await sonGonderimiOku();
    const yas = sonGonderim > 0 ? Date.now() - sonGonderim : Infinity;
    const kayitli = await isTracking();

    if (kayitli && yas < OLU_ESIK_MS) return; // gerçekten akıyor → dokunma

    if (kayitli) {
      // Zombi görev: kayıtlı ama veri gitmiyor. Yeniden başlatmadan ÖNCE sök.
      await stopTracking().catch(() => {});
    }
    const hata = await startTracking();
    console.log(
      hata
        ? `[uyandirma:${kaynak}] konum yeniden başlatılamadı: ${hata}`
        : `[uyandirma:${kaynak}] konum akışı yeniden başladı (yaş=${
            yas === Infinity ? "hiç" : Math.round(yas / 1000) + "sn"
          }, kayıtlıydı=${kayitli})`,
    );
  } catch (e) {
    console.log(`[uyandirma:${kaynak}] hata:`, e);
  }
}

/** Uygulama açılışında bir kez çağrılır (App.tsx). Dinleyicileri kurar ve
 *  kaldırma fonksiyonunu döndürür. */
export function uyandirmaDinleyicisiKur(): () => void {
  const alindi = Notifications.addNotificationReceivedListener((n) => {
    if (tipiOku(n.request.content.data) === YENIDEN_BASLAT) {
      void konumuDirilt("alindi");
    }
  });
  const dokunuldu = Notifications.addNotificationResponseReceivedListener((r) => {
    if (tipiOku(r.notification.request.content.data) === YENIDEN_BASLAT) {
      void konumuDirilt("dokunuldu");
    }
  });
  return () => {
    alindi.remove();
    dokunuldu.remove();
  };
}
