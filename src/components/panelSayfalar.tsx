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
  IconSearch,
  IconStore,
  IconTruck,
  IconUsers,
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
  /**
   * SAHİBE ÖZEL (2026-08-06): dükkân çalışanı bu sayfayı listede GÖRMEZ ve
   * adrese elle yazsa da giremez (sayfanın ilk satırında `sadeceSahip()`).
   * Para, kimlik ve fiyat kararı içeren her ekran buraya girer.
   */
  sahipOzel?: boolean;
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
    href: "/panel/halilar",
    label: "Halı Bul",
    kisa: "Halı Bul",
    aciklama: "Bu kimin halısı?",
    Icon: IconSearch,
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
    sahipOzel: true,
  },
  {
    href: "/panel/mutabakat",
    label: "Mutabakat",
    aciklama: "Şoförde bekleyen para",
    Icon: IconReceipt,
    sahipOzel: true,
  },
  {
    href: "/panel/profil",
    label: "Profil & Fiyat",
    aciklama: "Fotoğraf, m² fiyatın",
    Icon: IconStore,
    sahipOzel: true,
  },
  {
    href: "/panel/soforler",
    label: "Şoförler",
    aciklama: "Ekle, mesai aç kapa",
    Icon: IconTruck,
    sahipOzel: true,
  },
  {
    href: "/panel/calisanlar",
    label: "Çalışanlar",
    kisa: "Çalışan",
    aciklama: "Dükkân hesabı aç, kapat",
    Icon: IconUsers,
    sahipOzel: true,
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
    aciklama: "Aylık ciro, teslim, durak",
    Icon: IconChart,
    sahipOzel: true,
  },
];

/**
 * Role göre görünen sayfalar. Çalışan sahibe özel sayfaları LİSTEDE görmez;
 * adrese elle yazarsa da sayfanın kendi kapısı (`sadeceSahip()`) durdurur.
 * İki katman bilinçli: liste kozmetik, kapı güvenlik.
 */
export function sayfalarIcin(rol: "OWNER" | "STAFF"): PanelSayfa[] {
  return rol === "OWNER"
    ? PANEL_SAYFALAR
    : PANEL_SAYFALAR.filter((s) => !s.sahipOzel);
}

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
