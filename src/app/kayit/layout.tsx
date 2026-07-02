import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İşletme Kaydı",
  description:
    "Halı yıkama işletmeni ücretsiz kaydet — müşteriler seni konumuna göre bulsun, siparişlerini panelden yönet.",
};

export default function KayitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
