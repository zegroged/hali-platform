import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "Ön Bilgilendirme Formu",
  description:
    "Mesafeli Sözleşmeler Yönetmeliği uyarınca sipariş öncesi ön bilgilendirme formu.",
};

// TODO(künye): Şirket bilgileri (unvan, adres, vergi/MERSİS no, KEP)
// netleşince §1'deki geçici künye ifadesi gerçek bilgilerle değiştirilecek.
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
          telefonu sipariş takip sayfanızda yer alır.
        </p>
        <p>
          Platform işleticisinin ticari unvanı, merkez adresi, vergi/MERSİS
          numarası ve KEP adresi, işletme tescil işlemleri tamamlandığında bu
          bölümde yayımlanacaktır. İletişim: info@enyakinhaliyikamaservisi.com.
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
          ücretsiz iade hakkınız vardır.{" "}
          <strong>
            Kesin fiyatı onaylamanız, cayma süresi dolmadan hizmetin ifasına
            (yıkamaya) başlanmasına onay verdiğiniz anlamına gelir; bu onay
            sipariş kaydınıza işlenir.
          </strong>{" "}
          Yıkama tamamlandıktan sonra Mesafeli Sözleşmeler Yönetmeliği md.
          15/1-h uyarınca cayma hakkı kullanılamaz. Ayrıntı:{" "}
          <Link href="/iade" className="text-brand-dark underline">
            İptal ve İade Koşulları
          </Link>
          .
        </p>
      </Section>

      <Section title="6. Cayma/İptal Bildirim Kanalları">
        <p>
          Cayma veya iptal bildiriminizi (Yönetmelik md. 5/1-g uyarınca)
          şu kanallardan yapabilirsiniz: sipariş takip sayfanızda görünen{" "}
          <strong>işletme telefonu</strong>,{" "}
          <strong>info@enyakinhaliyikamaservisi.com</strong> e-posta adresi
          veya{" "}
          <Link href="/iletisim" className="text-brand-dark underline">
            iletişim sayfamız
          </Link>
          . Bildiriminizde sipariş takip kodunuzu belirtmeniz, talebinizin
          gecikmeden işleme alınmasını sağlar.
        </p>
      </Section>

      <Section title="7. Sipariş Adımları">
        <p>
          6563 sayılı Kanun md. 3 uyarınca sipariş şu teknik adımlarla
          kurulur: (1) size uygun işletmeyi seçersiniz; (2) sipariş formunu
          doldurursunuz — form gönderilmeden önce tüm alanları serbestçe
          düzeltebilirsiniz; (3) sipariş özetini ve onay kutusunu kontrol
          edersiniz; (4) talebi oluşturursunuz; (5) SMS ile gelen takip
          linkinden süreci adım adım izlersiniz. Sözleşme ve ön bilgilendirme
          metinlerine sipariş takip sayfanızdaki bağlantılardan her zaman
          erişebilirsiniz.
        </p>
      </Section>

      <Section title="8. Şikâyet ve Başvuru">
        <p>
          Şikâyetlerinizi önce işletmeye, ardından{" "}
          <Link href="/iletisim" className="text-brand-dark underline">
            platforma
          </Link>{" "}
          iletebilirsiniz. Ayrıca Tüketici Hakem Heyetleri ve Tüketici
          Mahkemelerine başvuru hakkınız saklıdır.
        </p>
      </Section>

      <Section title="9. Diğer Hususlar">
        <p>
          Uzaktan iletişim aracının (internet sitesi, SMS) kullanılması
          nedeniyle size ilave bir maliyet yansıtılmaz. Sipariş için depozito
          veya başkaca bir mali teminat alınmaz. Hizmet dijital içerik
          içermediğinden dijital içeriklere ilişkin hükümler uygulanmaz.
        </p>
      </Section>
    </StaticPage>
  );
}
