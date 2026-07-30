// Panel sayfalarının TEK KAYNAĞI (2026-07-30).
//
// Neden ayrı dosya: alt gezinme çubuğu (PanelNav) ile Özet sayfasındaki
// ana-ekran ızgarası aynı listeyi kullanmalı. İki yerde ayrı liste tutulursa
// biri güncellenip diğeri unutuluyor — bu projede aynı hata sipariş
// bildirimlerinde yaşandı (panel/şoför-web/şoför-app üçlüsü).
//
// `aciklama` alanı süs değil: kullanıcı kitlesi 50-65 yaş ve "Mutabakat"
// gibi başlıklar tek başına ne olduğunu söylemiyor. Izgarada başlığın altında
// gündelik Türkçeyle ne işe yaradığı yazıyor.

import {
  IconChart,
  IconHome,
  IconMapPin,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconRoute,
  IconStore,
  IconTruck,
  IconWallet,
  IconWhatsApp,
} from "@/components/icons";

type IconBileseni = (p: { size?: number; className?: string }) => React.ReactNode;

export type PanelSayfa = {
  href: string;
  label: string;
  /**
   * Mobil alt çubuk etiketi. 375px ekranda 5 sekme = sekme başına ~75px;
   * "Canlı Takip" tam etiketi oraya sığmayıp satır kırıyor. Kısası yoksa
   * `label` kullanılır.
   */
  kisa?: string;
  /** Izgarada başlığın altında görünen tek satırlık açıklama. */
  aciklama: string;
  Icon: IconBileseni;
};

export const PANEL_SAYFALAR: PanelSayfa[] = [
  { href: "/panel", label: "Özet", aciklama: "Günün durumu", Icon: IconHome },
  {
    href: "/panel/siparisler",
    label: "Siparişler",
    aciklama: "Gelen ve süren işler",
    Icon: IconPackage,
  },
  {
    href: "/panel/yeni-siparis",
    label: "Yeni Kayıt",
    kisa: "Yeni",
    aciklama: "Kapıdan gelen müşteri",
    Icon: IconPlus,
  },
  {
    href: "/panel/takip",
    label: "Canlı Takip",
    kisa: "Takip",
    aciklama: "Şoför şu an nerede",
    Icon: IconMapPin,
  },
  {
    href: "/panel/mesajlar",
    label: "Mesajlar",
    aciklama: "Müşteri WhatsApp'ları",
    Icon: IconWhatsApp,
  },
  {
    href: "/panel/kasa",
    label: "Kasa",
    aciklama: "Gelir gider defteri",
    Icon: IconWallet,
  },
  {
    href: "/panel/mutabakat",
    label: "Mutabakat",
    aciklama: "Şoförde bekleyen para",
    Icon: IconReceipt,
  },
  {
    href: "/panel/profil",
    label: "Profil & Fiyat",
    aciklama: "Fotoğraf, m² fiyatın",
    Icon: IconStore,
  },
  {
    href: "/panel/soforler",
    label: "Şoförler",
    aciklama: "Ekle, mesai aç kapa",
    Icon: IconTruck,
  },
  {
    href: "/panel/rota",
    label: "Rota Geçmişi",
    aciklama: "Şoför dün nerelerdeydi",
    Icon: IconRoute,
  },
  {
    href: "/panel/rapor",
    label: "Raporlar",
    aciklama: "Aylık ciro ve sayılar",
    Icon: IconChart,
  },
];

/** Mobil alt çubukta duracak sayfalar; kalanı "Daha fazla" içinde. */
export const MOBIL_ANA = [
  "/panel",
  "/panel/siparisler",
  "/panel/yeni-siparis",
  "/panel/takip",
];

export function aktifMi(pathname: string, href: string) {
  return href === "/panel" ? pathname === "/panel" : pathname.startsWith(href);
}
