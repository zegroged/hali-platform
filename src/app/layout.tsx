import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { validateConfig } from "@/lib/config";

// Sunucu render'ında yapılandırmayı doğrula (eksik/zayıf env ile canlıya çıkma).
validateConfig();

const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext → Türkçe karakterler (ç, ş, ğ, ı, ö, ü)
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "En Yakın Halı Yıkama",
  description: "Yakınındaki halıcıyı seç, halını kapından aldır, adım adım takip et.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Halı Yıkama", statusBarStyle: "default" },
};

export const viewport = {
  themeColor: "#0d9488",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
