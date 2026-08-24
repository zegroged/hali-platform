import type { Metadata } from "next";
import Link from "next/link";
import StaticPage from "../_static/StaticPage";
import { IconMail, IconPackage, IconPhone } from "@/components/icons";
import { SIRKET, isleticiTamAd, vergiSatiri } from "@/lib/sirket";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "En Yakın Halı Yıkama ile iletişime geçin: destek e-postası ve sık sorulan sorular.",
};

// wa.me uluslararası biçim ister: boşluklar atılır, baştaki 0 yerine ülke kodu 90 gelir.
// SIRKET.telefon tanımsızsa "[TELEFON]" olur; rakam çıkmazsa link üretme (wa.me/90 bozuk olur).
const telefonRakam = SIRKET.telefon.replace(/\D/g, "").replace(/^0/, "");
const waNumarasi = telefonRakam.length >= 10 ? `90${telefonRakam}` : null;

export default function IletisimPage() {
  return (
    <StaticPage
      title="İletişim"
      intro="Siparişiniz, işletme kaydınız veya platformla ilgili her konuda bize yazabilirsiniz. Genellikle aynı gün dönüş yaparız."
    >
      <div className="space-y-3">
        {/* E-posta */}
        <a
          href={`mailto:${SIRKET.eposta}`}
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-dark">
            <IconMail size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">
              E-posta
            </span>
            <span className="block truncate text-sm text-brand-dark">
              {SIRKET.eposta}
            </span>
          </span>
        </a>

        {/* Telefon / WhatsApp destek hattı — numara tanımlıysa göster */}
        {waNumarasi && (
          <a
            href={`https://wa.me/${waNumarasi}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-dark">
              <IconPhone size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                Telefon / WhatsApp
              </span>
              <span className="block text-sm text-brand-dark">
                {SIRKET.telefon}
              </span>
            </span>
          </a>
        )}

        {/* Sipariş takibi yönlendirmesi */}
        <Link
          href="/takip"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-dark">
            <IconPackage size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">
              Siparişinizi mi arıyorsunuz?
            </span>
            <span className="block text-sm text-slate-600">
              Takip kodunuzla sipariş durumunuzu anında görün.
            </span>
          </span>
        </Link>
      </div>

      {/* Ticari künye — ETAHS Yön. md.6/1 (iletişim başlığı altında tanıtıcı bilgiler) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Ticari Künye</h2>
        <dl className="mt-2 space-y-1 text-base text-slate-700">
          <div>
            <dt className="inline font-medium">İşletici: </dt>
            <dd className="inline">{isleticiTamAd}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Adres: </dt>
            <dd className="inline">{SIRKET.adres}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Vergi Dairesi/No: </dt>
            <dd className="inline">{vergiSatiri}</dd>
          </div>
          <div>
            <dt className="inline font-medium">KEP: </dt>
            <dd className="inline">{SIRKET.kep}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Telefon: </dt>
            <dd className="inline">{SIRKET.telefon}</dd>
          </div>
          <div>
            <dt className="inline font-medium">E-posta: </dt>
            <dd className="inline">{SIRKET.eposta}</dd>
          </div>
        </dl>
      </div>

      <p className="text-sm text-slate-600">
        Sık karşılaşılan sorular için önce{" "}
        <Link href="/sss" className="font-medium text-brand-dark hover:underline">
          SSS sayfamıza
        </Link>{" "}
        göz atabilirsiniz — cevabınız büyük ihtimalle oradadır.
      </p>
    </StaticPage>
  );
}
