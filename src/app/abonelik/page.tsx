import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";
import PlanCard from "@/components/PlanCard";
import { PLAN, merdivenAktif } from "@/lib/plan";

// FİYAT ÇALIŞMA ZAMANINDA OKUNUR (2026-08-10). Bu sayfa statik üretiliyordu ve
// fiyat BUILD anında gömülüyordu; `.env` Docker build aşamasına girmediği için
// (.dockerignore) merdiven açılsa bile ekranda eski rakam kalıyordu. Fiyat bir
// yapılandırma değeridir, derleme çıktısı değil.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abonelik ve Paketler",
  description:
    "En Yakın Halı Yıkama işletme aboneliği: aylık taban 750 TL + KDV. Müşteriler için platform tamamen ücretsizdir.",
};

export default function AbonelikPage() {
  return (
    <StaticPage
      title="Abonelik ve Paketler"
      intro="Platform, halı yıkama işletmelerine tek ve sade bir abonelik paketiyle hizmet verir. Müşteriler için sipariş oluşturmak tamamen ücretsizdir."
    >
      {/* Paket kartı — iyzico "abonelik paketlerini sitenizde sergileyin" kriteri */}
      <div className="mt-2">
        <PlanCard wide ctaHref="/kayit" ctaLabel="İşletmeni Ekle" />
      </div>

      <Section title="Ödeme ve Faturalandırma">
        {/* Rakam ELLE YAZILMAZ — PLAN'dan gelir. Elle yazıldığında merdiven
            açıldı ama bu paragraf 2.400'de kaldı ve aynı sayfada iki farklı
            fiyat göründü (2026-08-10'da yaşandı). */}
        <p>
          Abonelik bedeli{" "}
          <strong>
            aylık {PLAN.priceMonthly} (%{PLAN.kdvRate})
          </strong>
          , yani toplam <strong>{PLAN.priceGrossMonthly} TL</strong>&apos;dir
          {merdivenAktif ? " (tek şoför için taban fiyat; şoför sayısına göre değişir)" : ""}{" "}
          ve kayıt sırasında tahsil edilir
          {merdivenAktif ? "" : "; ödemesi alınmayan işletme yayına alınmaz"}.
          Bedel karşılığında e-arşiv fatura düzenlenir.
        </p>
        {/* Bu paragraf 2026-07-29'da yeniden yazıldı. Önce bayat bir metin
            vardı ("kartlı ödeme çok yakında, havale/EFT ile ödeyin") — oysa
            iyzico canlı. Yerine yazılan ilk düzeltme de eksikti: tek seferlik
            ödemeyi tek yolmuş gibi anlatıp otomatik yenilemeden hiç söz
            etmiyordu. Akışın gerçeği iki yolludur (odeme/abonelik/page.tsx). */}
        <p>
          Kayıt formunu tamamladığında panele girersin; ödeme ayrı bir adımdır
          ve iki yolu vardır. <strong>Düzenli ödeme talimatı:</strong> kartın
          iyzico&apos;nun güvenli formunda saklanır, sen iptal edene kadar her
          ay {PLAN.priceGrossMonthly} TL otomatik çekilir. Kart saklanması gerektiği için bu
          yolda <strong>kredi kartı</strong> kullanılmalıdır — banka (debit)
          kartları düzenli talimatta çoğu bankada kabul edilmez.{" "}
          <strong>Tek seferlik ödeme:</strong> banka kartı da geçer, her dönem
          panelden ödersin; dönem bitmeden 3 gün önce hatırlatma gider. Her iki
          yolda da kart bilgilerin iyzico&apos;da kalır, bize ulaşmaz.
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
