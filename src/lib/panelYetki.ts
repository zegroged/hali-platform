// ÇALIŞAN PANELİ — YETKİ KAPISI (2026-08-06).
//
// SORUN: işletmenin tek hesabı vardı, patronunki. Dükkândaki çalışan sipariş
// kaydetmek için patronun şifresiyle giriyor; kasayı, ciroyu, IBAN'ı, aboneliği
// ve fiyat listesini görüyor + değiştirebiliyordu.
//
// TASARIM KARARI — FAIL-CLOSED:
// `getCurrentBusiness()` (lib/panel.ts) DEĞİŞTİRİLMEDİ; hâlâ yalnız
// `role === "CLEANER"` kabul ediyor ve işletmeyi `ownerId` üzerinden buluyor.
// Yani onu çağıran ~30 yerin HEPSİ, hiçbir şey yapılmadan, sahibe özel kaldı.
// Çalışanın girebildiği yerler tek tek `getPanelBusiness()` ile AÇILIR.
// Tersini yapsaydık (herkesi kabul eden ortak fonksiyon + kısıtlı yerlere kapı)
// unutulan tek çağrı sızıntı olurdu.
//
// 🔴 SAYFA KAPISI PRISMA'DAN ÖNCE ÇAĞRILMALI. App Router'da korumalı sayfa
// layout'un redirect'ine GÜVENEMEZ: layout ile page paralel render edilir,
// yani layout yönlendirse bile page'in prisma sorgusu ÇALIŞIR ve veri RSC
// yükünde sızabilir. Bu yüzden her kısıtlı sayfanın İLK satırı `sadeceSahip()`.

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getAuthedUser } from "@/lib/auth";

export type PanelRol = "OWNER" | "STAFF";

export type PanelErisim = {
  businessId: string;
  rol: PanelRol;
  userId: string;
  /** Ekranda gösterilecek ad (çalışanın kendi adı). */
  kullaniciAdi: string;
};

/**
 * Panel erişimi: İŞLETME SAHİBİ veya ÇALIŞANI. İşletme kimliğini döndürür.
 * Sahiplik gerektiren hiçbir yerde kullanılmaz — orada `getCurrentBusiness()`
 * zaten tek başına yeterli (CLEANER şartı içinde).
 *
 * Çerez VEYA Bearer (mobil) kabul eder: panel uygulamada WebView'de açılıyor.
 */
export async function getPanelErisim(): Promise<PanelErisim | null> {
  const u = await getAuthedUser();
  if (!u) return null;

  if (u.role === "CLEANER") {
    const b = await prisma.cleanerBusiness.findUnique({
      where: { ownerId: u.id },
      select: { id: true },
    });
    if (!b) return null;
    return { businessId: b.id, rol: "OWNER", userId: u.id, kullaniciAdi: u.name };
  }

  if (u.role === "STAFF") {
    const s = await prisma.staff.findUnique({
      where: { userId: u.id },
      select: { businessId: true },
    });
    if (!s) return null;
    return {
      businessId: s.businessId,
      rol: "STAFF",
      userId: u.id,
      kullaniciAdi: u.name,
    };
  }

  return null;
}

/**
 * SAHİP-ONLY SAYFA KAPISI. Kısıtlı her panel sayfasının İLK satırı.
 * Prisma'ya dokunmadan önce çağrılmalı (yukarıdaki RSC sızıntısı notu).
 *
 * Çalışan `/panel`'e "yetki yok" uyarısıyla döner — çıkışa atılmaz, çünkü
 * oturumu geçerli; sadece o sayfa ona kapalı.
 */
export async function sadeceSahip(): Promise<void> {
  const u = await getSessionUser();
  if (!u) redirect("/giris");
  if (u.role === "STAFF") redirect("/panel?yetki=yok");
  if (u.role !== "CLEANER") redirect("/giris");
}

/**
 * SAHİP-ONLY AKSİYON KAPISI (server action / API içi). Sayfadan farkı:
 * yönlendirmez, fırlatır — form aksiyonunda redirect yutulabiliyor.
 */
export async function sahipMi(): Promise<boolean> {
  const u = await getAuthedUser();
  return u?.role === "CLEANER";
}

/** Aksiyonun başında çağır: çalışan çağırdıysa iş yapılmadan durur. */
export async function sahipGerekir(): Promise<void> {
  if (!(await sahipMi())) {
    throw new Error("Bu işlem için işletme sahibi hesabı gerekir.");
  }
}

/** Çalışanın göremeyeceği panel sayfaları — TEK KAYNAK (nav + kapı aynı listeyi okur). */
export const CALISANA_KAPALI = [
  "/panel/kasa",
  "/panel/mutabakat",
  "/panel/profil",
  "/panel/soforler",
  "/panel/calisanlar",
  "/panel/rapor",
  "/panel/abonelik",
];

export function calisanaKapaliMi(href: string): boolean {
  return CALISANA_KAPALI.some((k) => href === k || href.startsWith(k + "/"));
}
