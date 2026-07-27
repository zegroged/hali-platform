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
                <Link href="/hesabim" className="hover:text-white">
                  Üye girişi / Hesabım
                </Link>
              </li>
              <li>
                <Link href="/isletmeler-icin" className="hover:text-white">
                  İşletmeler için
                </Link>
              </li>
              <li>
                <Link href="/kayit" className="hover:text-white">
                  İşletmeni ekle
                </Link>
              </li>
              <li>
                <Link href="/sehirler" className="hover:text-white">
                  Şehirlere göre halı yıkama
                </Link>
              </li>
              <li>
                <Link href="/sss" className="hover:text-white">
                  Sık sorulan sorular
                </Link>
              </li>
              {/* ETAHS Yön. md.7: ana sayfadan doğrudan ulaşılan "işlem
                  rehberi" başlığı — içerik on-bilgilendirme'de mevcut. */}
              <li>
                <Link href="/on-bilgilendirme" className="hover:text-white">
                  İşlem Rehberi
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
                <Link href="/hakkimizda" className="hover:text-white">
                  Hakkımızda
                </Link>
              </li>
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
              <li>
                <Link href="/abonelik" className="hover:text-white">
                  Abonelik ve Paketler
                </Link>
              </li>
              <li>
                <Link href="/isletme-sozlesmesi" className="hover:text-white">
                  İşletme Sözleşmesi
                </Link>
              </li>
              <li>
                <Link href="/mesafeli-satis" className="hover:text-white">
                  Mesafeli Satış Sözleşmesi
                </Link>
              </li>
              <li>
                <Link href="/iade" className="hover:text-white">
                  İptal ve İade Koşulları
                </Link>
              </li>
              <li>
                <Link href="/on-bilgilendirme" className="hover:text-white">
                  Ön Bilgilendirme Formu
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-4 border-t border-slate-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            © 2026 En Yakın Halı Yıkama — [YASAL AD] · VKN:
            [VKN] · KEP: [KEP] · Selçuklu/Konya
          </p>
          <div className="flex flex-col gap-1.5 sm:items-end">
            {/* iyzico logo bandı (resmî paket, beyaz sürüm) — ödeme güven işareti */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/iyzico-band-white.svg"
              alt="iyzico ile güvenli ödeme — Visa, Mastercard, Troy"
              loading="lazy"
              decoding="async"
              className="h-6 w-auto max-w-full opacity-90 sm:h-7"
            />
            {/* Yanıltıcılık önlemi: bantta kart logoları var ama MÜŞTERİ tahsilatı
                nakit (iyzico yalnız işletme aboneliğinde kullanılıyor). "Çok
                yakında" ifadesi 2026-07-27'de KALDIRILDI (kullanıcı kararı):
                tarihi belli olmayan söz vermeyelim — durum bilgisi kalsın. */}
            <p className="text-xs text-slate-500">
              Sipariş ödemesi teslimde nakit alınır.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
