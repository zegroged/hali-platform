import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { validateConfig } from "@/lib/config";
import VersionSkewGuard from "@/components/VersionSkewGuard";

// Sunucu render'ında yapılandırmayı doğrula (eksik/zayıf env ile canlıya çıkma).
validateConfig();

const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext → Türkçe karakterler (ç, ş, ğ, ı, ö, ü)
  variable: "--font-inter",
  display: "swap",
});

const SITE_NAME = "En Yakın Halı Yıkama";
const SITE_DESCRIPTION =
  "Yakınındaki halı yıkamacıları karşılaştır, halın kapından alınsın, adım adım takip et. Ödeme teslimde — ön ödeme yok.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_BASE_URL ?? "https://enyakinhaliyikamaservisi.com"
  ),
  title: {
    default: "En Yakın Halı Yıkama — Kapıdan Halı Yıkama Hizmeti",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: SITE_NAME,
    title: "En Yakın Halı Yıkama — Kapıdan Halı Yıkama Hizmeti",
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: { title: "Halı Yıkama", statusBarStyle: "default" },
};

export const viewport = {
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={inter.variable}>
      <body className="font-sans">
        <VersionSkewGuard />
        {children}
      </body>
    </html>
  );
}
