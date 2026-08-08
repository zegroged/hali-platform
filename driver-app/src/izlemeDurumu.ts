import AsyncStorage from "@react-native-async-storage/async-storage";

// 🔴 İZLEME DURUMU KALICI DEPODA (2026-08-08, canlı veriyle ölçülerek bulundu).
//
// NEDEN: bütün süzgeç/fren değişkenleri (`lastSent`, `demir`, `durum`,
// `lastOrderCheck`, `sonGonderimAt`) modül seviyesinde `let` idi — yani yalnız
// BELLEKTE. Expo arka plan görevi headless bir JS bağlamında çalışır; o bağlam
// çağrılar arasında yıkılabilir ya da aynı anda birden fazla kopya koşabilir.
// Her iki durumda da frenler sıfırlanır.
//
// ÖLÇÜM (canlı, iki bağımsız imza — ikisi de aynı kökü gösterdi):
//   · Duruyorken 60 sn'de bir olması gereken ping → 8-9 sn'de bir, üst üste 8 kez
//   · 45 sn'de bir olması gereken sipariş yoklaması → 2 SANİYEDE 6 istek
// 45 saniyelik bir fren, 2 saniyede 6 istek üretemez. Durum tutmuyordu.
//
// SONUÇLARI: 8 kat gereksiz ping (pil + veri + disk) · demirlemenin baypas
// olma riski (4.65'in tamamı arka planda devre dışı kalabilir) · ekrandaki
// "son konum" göstergesinin yalan söylemesi · aynı iş için tekrar tekrar
// "Yeni iş atandı" bildirimi.
//
// ⚠️ DÜRÜST SINIR: eşzamanlı iki çağrı hâlâ birbirinin yazımını ezebilir
// (oku-değiştir-yaz yarışı; kilit için native modül gerekirdi). En kötü hâlde
// FAZLADAN BİR ping gider — 8 kat israfın yerine bu kabul edilebilir.

const ANAHTAR = "hali-izleme-durumu";

export type IzlemeDurumu = {
  /** Son GÖNDERİLEN konum + anı — 25 m / 60 sn süzgecinin dayanağı. */
  lastSent: { lat: number; lng: number; t: number } | null;
  /** Duruyor mu, hareket hâlinde mi. */
  durum: "DURUYOR" | "HAREKETTE";
  /** Duruyorken sunucuya bildirilen sabit çıpa. */
  demir: { lat: number; lng: number } | null;
  /** Üst üste kaç uzak fix görüldü (hareket onayı için). */
  uzakArdisik: number;
  /** Son hareket anı (ms). */
  sonHareketAt: number;
  /** Sipariş yoklamasının son çalıştığı an (ms) — 45 sn freni. */
  lastOrderCheck: number;
  /** Son BAŞARILI gönderim anı (ms) — ekrandaki göstergenin kaynağı. */
  sonGonderimAt: number;
};

export const BOS_DURUM: IzlemeDurumu = {
  lastSent: null,
  durum: "DURUYOR",
  demir: null,
  uzakArdisik: 0,
  sonHareketAt: 0,
  lastOrderCheck: 0,
  sonGonderimAt: 0,
};

/** Bellek kopyası: aynı bağlam içinde art arda çağrılarda diskten okumayalım.
 *  Bağlam yıkılırsa bu da gider — o yüzden DİSK tek doğru kaynak. */
let bellek: IzlemeDurumu | null = null;

export async function durumuOku(): Promise<IzlemeDurumu> {
  if (bellek) return bellek;
  try {
    const ham = await AsyncStorage.getItem(ANAHTAR);
    if (ham) {
      const d = JSON.parse(ham) as Partial<IzlemeDurumu>;
      // Alan alan birleştir: eski sürümden gelen eksik anahtar çökertmesin.
      bellek = { ...BOS_DURUM, ...d };
      return bellek;
    }
  } catch {
    // Okunamadıysa temiz başla — izleme durmasın.
  }
  bellek = { ...BOS_DURUM };
  return bellek;
}

export async function durumuYaz(d: IzlemeDurumu): Promise<void> {
  bellek = d;
  try {
    await AsyncStorage.setItem(ANAHTAR, JSON.stringify(d));
  } catch {
    // Yazılamazsa bellek kopyası yine de güncel; en kötü ihtimalle bağlam
    // yıkılınca bir fazladan ping gider.
  }
}

/** Yeni mesai = temiz sayfa (dünkü çıpa bugüne taşınmasın). */
export async function durumuSifirla(): Promise<void> {
  await durumuYaz({ ...BOS_DURUM });
}

/** Ekrandaki "son konum" göstergesi için — bağlam yıkılsa bile doğru okur. */
export async function sonGonderimiOku(): Promise<number> {
  return (await durumuOku()).sonGonderimAt;
}
