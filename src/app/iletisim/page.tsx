import type { Metadata } from "next";
import Link from "next/link";
import StaticPage from "../_static/StaticPage";
import { IconMail, IconPackage, IconPhone } from "@/components/icons";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "En Yakın Halı Yıkama ile iletişime geçin: destek e-postası ve sık sorulan sorular.",
};

export default function IletisimPage() {
  return (
    <StaticPage
      title="İletişim"
      intro="Siparişiniz, işletme kaydınız veya platformla ilgili her konuda bize yazabilirsiniz. Genellikle aynı gün dönüş yaparız."
    >
      <div className="space-y-3">
        {/* E-posta */}
        <a
          href="mailto:info@enyakinhaliyikamaservisi.com"
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
              info@enyakinhaliyikamaservisi.com
            </span>
          </span>
        </a>

        {/* WhatsApp — numara netleşince aktive edilecek */}
        {/* TODO: gerçek numara — aşağıdaki karta wa.me linki eklenip yayına alınacak */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-dark">
            <IconPhone size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">
              WhatsApp destek hattı
            </span>
            <span className="block text-sm text-slate-500">Çok yakında</span>
          </span>
        </div>

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
