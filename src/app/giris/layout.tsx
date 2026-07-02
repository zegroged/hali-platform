import type { Metadata } from "next";
import type { ReactNode } from "react";

// /giris client component olduğu için sayfa başlığı bu ince server layout'tan gelir.
export const metadata: Metadata = { title: "İşletme Girişi" };

export default function GirisLayout({ children }: { children: ReactNode }) {
  return children;
}
