import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "Ön Bilgilendirme Formu",
  description:
    "Mesafeli Sözleşmeler Yönetmeliği uyarınca sipariş öncesi ön bilgilendirme formu.",
};

// TODO(künye): [KÖŞELİ] alanlar şirket bilgileri netleşince doldurulacak.
export default function OnBilgilendirmePage() {
  return (
    <StaticPage
      title="Ön Bilgilendirme Formu"
      intro="Mesafeli Sözleşmeler Yönetmeliği md. 5 uyarınca, sipariş oluşturmadan önce aşağıdaki bilgileri dikkatinize sunarız."
    >
      <Section title="1. Hizmeti Sunanlar">
        <p>
          Halı yıkama hizmeti, platformda listelenen ve siparişte sizin
          seçtiğiniz bağımsız işletme tarafından verilir; işletmenin ünvanı ve
          telefonu sipariş takip sayfanızda yer alır. Platform işleticisi
          (aracı hizmet sağlayıcı): [ŞİRKET ÜNVANI], [ADRES], Vergi
          Dairesi/No: [VERGİ DAİRESİ / VERGİ NO].
        </p>
      </Section>

      <Section title="2. Hizmetin Temel Nitelikleri">
        <p>
          Halınız adresinizden alınır, işletmede yıkanır ve adresinize teslim
          edilir. Süreci takip kodu/linkiyle adım adım izlersiniz; araç yola
          çıktığında canlı konum görürsünüz.
        </p>
      </Section>

      <Section title="3. Fiyat ve Ödeme">
        <p>
          Profillerdeki birim fiyatlar (TL/m², ek hizmetler) tahminidir;{" "}
          <strong>kesin fiyat halınız ölçüldükten sonra bildirilir</strong> ve
          onayınız alınır. Sipariş oluşturmak ücretsizdir; ön ödeme/kapora
          alınmaz. Ödeme teslimde nakit yapılır (online kartlı ödeme aktif
          olduğunda iyzico güvencesiyle kartla da ödeyebilirsiniz; olası ek
          bedeller ödeme adımında ayrıca gösterilir).
        </p>
      </Section>

      <Section title="4. Teslim Süresi">
        <p>
          Tahmini teslim süresi işletme profilinde &quot;iş günü&quot; olarak
          belirtilir; sipariş bazında güncel tahmin takip sayfanızda
          gösterilir.
        </p>
      </Section>

      <Section title="5. Cayma Hakkı ve İstisnası">
        <p>
          Halı alınmadan ücretsiz iptal; kesin fiyat sonrası yıkanmadan
          ücretsiz iade hakkınız vardır. Yıkama ifa edildikten sonra cayma
          hakkı bulunmaz (Yönetmelik md. 15/1-h). Ayrıntı:{" "}
          <Link href="/iade" className="text-brand-dark underline">
            İptal ve İade Koşulları
          </Link>
          .
        </p>
      </Section>

      <Section title="6. Şikâyet ve Başvuru">
        <p>
          Şikâyetlerinizi önce işletmeye, ardından{" "}
          <Link href="/iletisim" className="text-brand-dark underline">
            platforma
          </Link>{" "}
          iletebilirsiniz. Ayrıca Tüketici Hakem Heyetleri ve Tüketici
          Mahkemelerine başvuru hakkınız saklıdır.
        </p>
      </Section>
    </StaticPage>
  );
}
