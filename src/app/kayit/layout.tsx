import { PLAN } from "@/lib/plan";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İşletme Kaydı",
  description:
    `Halı yıkama işletmeni kaydet — siparişlerini, şoförlerini ve kâr-zararını tek panelden yönet, bölgenin sayfasında listelen. Aylık ${PLAN.priceMonthly} abonelik.`,
};

export default function KayitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
