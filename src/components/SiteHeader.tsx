import Link from "next/link";
import { Logo, IconPackage } from "@/components/icons";

/** Kamusal sayfaların ortak üst başlığı (ana sayfa + şehir sayfaları). */
export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between py-4">
      <Link href="/" className="flex min-w-0 items-center gap-2">
        <Logo size={30} />
        <span className="whitespace-nowrap text-sm font-bold tracking-tight text-slate-900 sm:text-lg">
          En Yakın Halı Yıkama
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <Link
          href="/takip"
          aria-label="Sipariş takibi"
          className="inline-flex items-center gap-1 py-2 text-sm font-medium text-slate-600 hover:text-brand-dark"
        >
          <IconPackage size={17} />
          <span className="hidden sm:inline">Takip</span>
        </Link>
        <Link
          href="/giris"
          className="inline-flex items-center whitespace-nowrap py-2 text-sm font-medium text-slate-600 hover:text-brand-dark"
        >
          Giriş Yap
        </Link>
        <Link
          href="/kayit"
          className="inline-flex items-center whitespace-nowrap rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand-dark transition hover:bg-brand-light"
        >
          <span className="sm:hidden">İşletme</span>
          <span className="hidden sm:inline">İşletmeni ekle</span>
        </Link>
      </div>
    </header>
  );
}
