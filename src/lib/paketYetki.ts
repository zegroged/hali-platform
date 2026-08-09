// ABONELİK TÜRÜNE GÖRE MODÜL KISITLAMASI (FIYAT-2026-08-09.md §1-C).
//
// Bugüne kadar abonelik TEK bir şeyi kapatıyordu: keşifte görünmek ve sipariş
// almak. Panelin içi tamamen açıktı — 36 işletme KASA'yı, canlı konumu ve rota
// geçmişini bedava kullanıyor. Merdiven modeli bunu değiştiriyor: VİTRİN kalıcı
// ücretsizdir (profil + listelenme + sipariş defteri), ücretli modüller
// YÖNETİM'den itibaren açılır.
//
// 🔴 TASARIM — FAIL-CLOSED VE TEK KAYNAK:
// `etkinPaket()` HEM planı HEM dönemin geçerliliğini birlikte okur. Dönem
// dolmuş bir YÖNETİM aboneliği VİTRİN'dir; yani "ödemeyi kesen işletme
// silinmez, VİTRİN'e düşer" kuralı tek fonksiyonda durur ve kimse ayrıca
// dönem kontrolü yazmak zorunda kalmaz (yazarsa da ikinci doğruluk kaynağı
// oluşur — bu projede daha önce abonelik kontrolü ÜÇ ayrı yere dağılmıştı).
//
// 🔴 SAYFA KAPISI PRISMA'DAN ÖNCE: App Router'da korumalı sayfa layout'un
// redirect'ine güvenemez (bkz. panelYetki.ts başlığı). Modül kapısı da aynı
// kurala tabidir — `modulGerekir()` sayfanın İLK satırında çağrılmalı.
//
// ⚠️ BU KATMAN BUGÜN FİİLEN ETKİSİZDİR ve bu KASITLIDIR: canlıdaki 39
// aboneliğin hepsi ACTIVE + dönemi geçerli + plan=YONETIM, yani `etkinPaket`
// hepsi için YONETIM döndürür ve hiçbir modül kapanmaz. Kapanma, geçiş planı
// (FIYAT §6) uyarınca işletmeler VİTRİN'e taşındığında başlar.

import { redirect } from "next/navigation";
import { subscriptionActive } from "@/lib/subscription";
import type { Paket } from "@/lib/plan";
import { SOFOR_TAVANI } from "@/lib/plan";

/** Paket kapısı olan modüller. Bu listede OLMAYAN her şey ücretsizdir —
 *  sipariş defteri, durum makinesi, manuel kayıt, takip kodu, profil,
 *  listelenme, yorum, e-posta bildirimi. */
export type Modul =
  | "KASA"
  | "MUTABAKAT"
  | "CANLI_KONUM"
  | "ROTA_GECMISI"
  | "DURAK_RAPORU"
  | "WHATSAPP"
  | "FOTO_ARSIV"
  | "TELEFON_DESTEK";

/** Kullanıcıya gösterilecek ad — kilit ekranı ve uyarı metinleri buradan okur,
 *  böylece aynı modül iki yerde iki türlü adlandırılmaz. */
export const MODUL_ADI: Record<Modul, string> = {
  KASA: "Kasa (gelir-gider defteri)",
  MUTABAKAT: "Gün sonu nakit mutabakatı",
  CANLI_KONUM: "Canlı şoför konumu",
  ROTA_GECMISI: "Rota geçmişi",
  DURAK_RAPORU: "Durak süresi raporu",
  WHATSAPP: "WhatsApp bildirimleri",
  FOTO_ARSIV: "Fotoğraf arşivi",
  TELEFON_DESTEK: "Telefon desteği",
};

type SubLike = {
  status: string;
  currentPeriodEnd: Date | null;
  plan?: Paket | null;
} | null | undefined;

/**
 * İşletmenin ŞU ANDAKİ fiili paketi.
 *
 * Aboneliği yok, dönemi dolmuş veya iptal edilmişse VİTRİN'dir — veri silinmez,
 * işletme yayından kalkmaz, yalnız ücretli modüller kapanır. Bu, kararın
 * "geri alma öfkesini" düşüren tasarım kararıdır (FIYAT §6).
 */
export function etkinPaket(sub: SubLike): Paket {
  if (!sub) return "VITRIN";
  if (!subscriptionActive(sub)) return "VITRIN";
  const p = sub.plan;
  return p === "FILO" || p === "YONETIM" || p === "VITRIN" ? p : "VITRIN";
}

/** Bu paket bu modülü görebilir mi. FİLO, YÖNETİM'in üst kümesidir. */
export function modulAcik(paket: Paket, _modul: Modul): boolean {
  return paket === "YONETIM" || paket === "FILO";
}

/** Kısayol: aboneliği verip doğrudan sor. */
export function modulErisimi(sub: SubLike, modul: Modul): boolean {
  return modulAcik(etkinPaket(sub), modul);
}

/**
 * SAYFA KAPISI. Kısıtlı modül sayfasının İLK satırında, prisma'dan ÖNCE.
 * Kapalıysa işletmeyi yükseltme ekranına atar — çıkışa değil, çünkü oturumu
 * geçerli ve işletmesi yayında; kapalı olan yalnız o modül.
 */
export function modulGerekir(sub: SubLike, modul: Modul): void {
  if (!modulErisimi(sub, modul)) redirect(`/panel/abonelik?kilit=${modul}`);
}

/**
 * API/AKSİYON KAPISI. Sayfadan farkı: yönlendirmez, false döner — çağıran
 * 403 üretir. Panel sayfasını kilitleyip API ucunu açık bırakmak kilidi
 * anlamsız kılar (denetim bulgusu: şoför uygulaması konum göndermeye,
 * uçlar da servis etmeye devam ederdi).
 */
export function modulAcikMi(sub: SubLike, modul: Modul): boolean {
  return modulErisimi(sub, modul);
}

// ---------------------------------------------------------------- koltuklar

/**
 * Bu işletme yeni bir şoför EKLEYEBİLİR Mİ.
 *
 * Merdiven şoför sayısına bağlı olduğu için koltuk kapısı SERT olmak zorunda:
 * yumuşak uyarı bırakılırsa halıcı ikinci şoförü ekler, sistem farkı isteyemez
 * ve merdiven kâğıt üstünde kalır (denetim bulgusu). Tavana ulaşmış paket
 * (FİLO / 4+ koltuk) sınırsızdır.
 *
 * `mevcutSofor` = bugün tanımlı, ENGELLENMEMİŞ şoför sayısı.
 */
export function soforEklenebilir(
  paket: Paket,
  koltuk: number,
  mevcutSofor: number,
): boolean {
  if (paket === "VITRIN") return mevcutSofor < 1; // vitrinde 1 şoför atanabilir
  if (paket === "FILO") return true;
  if (koltuk >= SOFOR_TAVANI) return true; // tavan = sınırsız
  return mevcutSofor < Math.max(1, koltuk);
}

/** Kapı kapandığında ekrana yazılacak cümle — sebebi ve çıkışı birlikte söyler. */
export function soforKapisiMesaji(paket: Paket, koltuk: number): string {
  if (paket === "VITRIN") {
    return "Vitrin paketinde tek şoför tanımlanabilir. Şoför eklemek için aboneliğinizi başlatın.";
  }
  return `Paketinizde ${koltuk} şoför koltuğu var. Yeni şoför eklemek için paketinizi yükseltin.`;
}
