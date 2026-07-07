import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";
import PlanCard from "@/components/PlanCard";

export const metadata: Metadata = {
  title: "Abonelik ve Paketler",
  description:
    "En Yakın Halı Yıkama işletme aboneliği: ilk 30 gün ücretsiz, sonrasında 2.000 TL/ay. Müşteriler için platform tamamen ücretsizdir.",
};

export default function AbonelikPage() {
  return (
    <StaticPage
      title="Abonelik ve Paketler"
      intro="Platform, halı yıkama işletmelerine tek ve sade bir abonelik paketiyle hizmet verir. Müşteriler için sipariş oluşturmak tamamen ücretsizdir."
    >
      {/* Paket kartı — iyzico "abonelik paketlerini sitenizde sergileyin" kriteri */}
      <div className="mt-2">
        <PlanCard ctaHref="/kayit" />
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
