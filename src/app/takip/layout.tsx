import type { Metadata } from "next";

// /takip sayfası client bileşen olduğundan metadata export edemez —
// başlığı bu ince server layout verir (layout.tsx'teki title.template ile birleşir).
export const metadata: Metadata = {
  title: "Sipariş Takibi",
};

export default function TakipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
