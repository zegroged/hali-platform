import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İşletme Kaydı",
  description:
    "Halı yıkama işletmeni kaydet — müşteriler seni konumuna göre bulsun, siparişlerini panelden yönet. Aylık 2.000 TL + KDV abonelik.",
};

export default function KayitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
