import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "Abonelik ve Paketler",
  description:
    "En Yakın Halı Yıkama işletme aboneliği: ilk 30 gün ücretsiz, sonrasında 2.000 TL/ay. Müşteriler için platform tamamen ücretsizdir.",
};

// Pakete dahil olanlar — hepsi üründe bugün var olan özellikler; olmayan vaat yazma.
const FEATURES = [
  "Keşif sayfalarında bölgendeki müşterilere görünürlük",
  "Sınırsız sipariş talebi — sipariş başına komisyon yok",
  "Sipariş yönetim paneli (onay, adım adım ilerletme, kesin fiyat bildirimi)",
  "Şoför yönetimi ve mesai boyunca canlı konum takibi",
  "Rota geçmişi ve aylık durak raporu",
  "Alım ve teslimde fotoğraflı kanıt",
  "Dükkâna gelen müşterin için takip kodlu manuel sipariş kaydı",
  "Doğrulanmış İşletme rozeti ile güven",
];

export default function AbonelikPage() {
  return (
    <StaticPage
      title="Abonelik ve Paketler"
      intro="Platform, halı yıkama işletmelerine tek ve sade bir abonelik paketiyle hizmet verir. Müşteriler için sipariş oluşturmak tamamen ücretsizdir."
    >
      {/* Paket kartı — iyzico "abonelik paketlerini sitenizde sergileyin" kriteri */}
      <div className="rounded-2xl border-2 border-brand bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">
            İşletme Aboneliği
          </h2>
          <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-dark">
            İlk 30 gün ücretsiz
          </span>
        </div>
        <p className="mt-4">
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            2.000 TL
          </span>
          <span className="text-base text-slate-500"> / ay</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Yönetici onayından sonraki ilk 30 gün ücretsiz deneme dönemidir;
          deneme süresince ücret alınmaz.
        </p>
        <ul className="mt-5 space-y-2 text-sm text-slate-700">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <svg
                viewBox="0 0 20 20"
                className="mt-0.5 h-4 w-4 shrink-0 fill-brand"
                aria-hidden
              >
                <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4l2.3 2.29 6.3-6.3a1 1 0 0 1 1.4 0Z" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
        <Link
          href="/kayit"
          className="mt-6 block rounded-xl bg-brand px-4 py-3 text-center text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Hemen kaydol — ilk 30 gün ücretsiz
        </Link>
      </div>

      <Section title="Ödeme ve Faturalandırma">
        <p>
          Abonelik bedeli, ücretsiz deneme süresinin bitiminden itibaren{" "}
          <strong>aylık olarak</strong> tahakkuk eder. Online kartlı ödeme
          altyapımız (anlaşmalı ödeme kuruluşu ile){" "}
          <strong>çok yakında</strong> aktif olacaktır; o zamana kadar ödeme,
          onay sürecinde tarafınıza iletilen havale/EFT bilgileriyle yapılır.
        </p>
        <p>
          Müşteri siparişlerinden ayrıca <strong>komisyon alınmaz</strong>;
          sıralamada veya tavsiyede öne çıkarma karşılığında hiçbir bedel
          alınmaz.
        </p>
      </Section>

      <Section title="İptal ve Fesih">
        <p>
          Aboneliğini dilediğin zaman feshedebilirsin; fesih tarihine kadar
          tahakkuk etmiş abonelik bedelleri ödenir, ileriye dönük borç doğmaz.
          Ayrıntılar{" "}
          <Link
            href="/isletme-sozlesmesi"
            className="font-medium text-brand-dark hover:underline"
          >
            İşletme Sözleşmesi
          </Link>
          &apos;nin 3. ve ilgili maddelerinde düzenlenmiştir.
        </p>
      </Section>

      <Section title="Müşteriler İçin">
        <p>
          Platformu kullanan <strong>müşterilerden hiçbir ücret alınmaz</strong>:
          sipariş oluşturmak, takip etmek ve iletişim ücretsizdir. Halı yıkama
          hizmetinin bedeli, teslimde doğrudan seçtiğin işletmeye ödenir.
        </p>
      </Section>
    </StaticPage>
  );
}
