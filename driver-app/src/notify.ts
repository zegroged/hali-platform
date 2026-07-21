import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listOrders } from "./api";

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
