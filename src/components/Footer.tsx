import Link from "next/link";
import { Logo } from "@/components/icons";

/** Kamusal sayfaların altına konan kurumsal footer (panel/admin/sofor hariç). */
export default function Footer() {
  return (
    <footer className="mt-16 bg-slate-900 text-slate-300">
      <div className="mx-auto w-full max-w-lg px-4 py-10 md:max-w-3xl lg:max-w-5xl">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <Logo size={26} />
              <span className="text-sm font-semibold text-white">
                En Yakın Halı Yıkama
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Yakınındaki halıcıyı seç, halın kapından alınsın, adım adım takip
              et. Ödeme teslimde — ön ödeme yok.
            </p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Hizmet
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/#nasil-calisir" className="hover:text-white">
                  Nasıl çalışır?
                </Link>
              </li>
              <li>
                <Link href="/takip" className="hover:text-white">
                  Sipariş takibi
                </Link>
              </li>
              <li>
                <Link href="/giris" className="hover:text-white">
                  İşletmeni ekle
                </Link>
              </li>
              <li>
                <Link href="/sss" className="hover:text-white">
                  Sık sorulan sorular
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Kurumsal
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/iletisim" className="hover:text-white">
                  İletişim
                </Link>
              </li>
              <li>
                <Link href="/kvkk" className="hover:text-white">
                  KVKK Aydınlatma Metni
                </Link>
              </li>
              <li>
                <Link href="/gizlilik" className="hover:text-white">
                  Gizlilik Politikası
                </Link>
              </li>
              <li>
                <Link href="/kosullar" className="hover:text-white">
                  Kullanım Koşulları
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-slate-800 pt-6 text-xs text-slate-500">
          © 2026 En Yakın Halı Yıkama. Tüm hakları saklıdır.
        </p>
      </div>
    </footer>
  );
}
