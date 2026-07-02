import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "Mesafeli Satış Sözleşmesi",
  description:
    "En Yakın Halı Yıkama üzerinden verilen siparişlerde geçerli mesafeli satış sözleşmesi.",
};

// TODO(künye): Şirket ünvanı, adres, vergi dairesi/no ve MERSİS bilgileri
// netleşince §1'deki geçici künye ifadesi gerçek bilgilerle değiştirilecek
// (iyzico başvurusu öncesi ŞART).
export default function MesafeliSatisPage() {
  return (
    <StaticPage
      title="Mesafeli Satış Sözleşmesi"
      intro="Bu sözleşme, enyakinhaliyikamaservisi.com üzerinden sipariş oluşturan müşteri (ALICI) ile siparişte seçilen halı yıkama işletmesi (HİZMET SAĞLAYICI) arasında, 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca kurulur."
    >
      <Section title="1. Taraflar ve Aracı Hizmet Sağlayıcı">
        <p>
          <strong>ALICI:</strong> Sipariş formunda ad-soyad, telefon ve adres
          bilgilerini veren kişi.
        </p>
        <p>
          <strong>HİZMET SAĞLAYICI (SATICI):</strong> Siparişte seçilen ve
          takip sayfasında ünvanı/telefonu görünen halı yıkama işletmesi.
          Hizmetin ifasından bu işletme sorumludur.
        </p>
        <p>
          <strong>ARACI HİZMET SAĞLAYICI (PLATFORM):</strong>{" "}
          enyakinhaliyikamaservisi.com. Platform işleticisinin ticari unvanı,
          merkez adresi, vergi/MERSİS numarası ve KEP adresi, işletme tescil
          işlemleri tamamlandığında bu bölümde yayımlanacaktır. İletişim:
          info@enyakinhaliyikamaservisi.com (
          <Link href="/iletisim" className="text-brand-dark underline">
            iletişim sayfası
          </Link>
          ). Platform, 6563 sayılı Kanun kapsamında aracı hizmet sağlayıcıdır;
          hizmeti bizzat ifa etmez.
        </p>
      </Section>

      <Section title="2. Sözleşmenin Konusu">
        <p>
          Sözleşmenin konusu; ALICI&apos;nın platform üzerinden talep ettiği
          halı yıkama hizmetinin (halının adresten alınması, yıkanması ve
          adrese teslimi) ifası ile tarafların hak ve yükümlülüklerinin
          belirlenmesidir.
        </p>
      </Section>

      <Section title="3. Hizmet Bedeli ve Ödeme">
        <p>
          Profillerde görünen birim fiyatlar (TL/m² ve ek hizmetler) işletme
          beyanıdır; <strong>kesin bedel</strong>, halı alınıp ölçüldükten
          sonra ALICI&apos;ya bildirilir. ALICI kesin bedeli kabul etmezse halı
          yıkanmadan ücretsiz iade edilir. Ödeme, hizmet tesliminde{" "}
          <strong>nakit</strong> olarak hizmet sağlayıcıya yapılır; online
          kartlı ödeme aktif edildiğinde tahsilat, iyzico ödeme kuruluşu
          aracılığıyla platform üzerinden hizmet sağlayıcı nam ve hesabına
          gerçekleştirilir.
        </p>
      </Section>

      <Section title="4. İfa Süresi ve Teslim">
        <p>
          Tahmini alım ve teslim süreleri işletme profilinde ve sipariş takip
          sayfasında gösterilir. Hizmet, ALICI&apos;nın sipariş formunda
          bildirdiği adreste ifa edilir (alım ve teslim aynı adrese yapılır;
          farklı adres, işletmeyle telefonla kararlaştırılabilir).
        </p>
      </Section>

      <Section title="5. Cayma Hakkı">
        <p>
          ALICI; halı adresten alınmadan önce ücretsiz iptal, kesin fiyat
          bildirildikten sonra yıkama başlamadan ücretsiz iade hakkına
          sahiptir.{" "}
          <strong>
            Kesin fiyatı onaylamanız, cayma süresi dolmadan hizmetin ifasına
            (yıkamaya) başlanmasına onay verdiğiniz anlamına gelir; bu onay
            sipariş kaydınıza işlenir.
          </strong>{" "}
          Yıkama tamamlandıktan sonra Mesafeli Sözleşmeler Yönetmeliği md.
          15/1-h uyarınca cayma hakkı kullanılamaz. Ayrıntılar:{" "}
          <Link href="/iade" className="text-brand-dark underline">
            İptal ve İade Koşulları
          </Link>
          .
        </p>
      </Section>

      <Section title="6. Kusurlu İfa">
        <p>
          Kusuru fark eder etmez, tercihen teslimden itibaren 48 saat içinde
          bildirmenizi öneririz — bu bir{" "}
          <strong>hak düşürücü süre değildir</strong>; 6502 sayılı Kanun md.
          15-16&apos;daki yasal haklarınız saklıdır. Ayıplı hizmette{" "}
          <strong>seçiminize bağlı olarak</strong>: hizmetin yeniden
          görülmesi, bedel indirimi, ücretsiz onarım/yeniden yıkama veya
          sözleşmeden dönme (bedel iadesi) haklarına sahipsiniz.
        </p>
        <p>
          Platform çözüm sürecine aracılık eder; sipariş kayıtları ve teslim
          fotoğrafları delil niteliğindedir.
        </p>
      </Section>

      <Section title="7. Kişisel Veriler">
        <p>
          Sipariş kapsamında işlenen kişisel veriler hakkında{" "}
          <Link href="/kvkk" className="text-brand-dark underline">
            KVKK Aydınlatma Metni
          </Link>{" "}
          geçerlidir. Sipariş bilgileri yalnızca seçilen hizmet sağlayıcıyla
          paylaşılır.
        </p>
      </Section>

      <Section title="8. Uyuşmazlık Çözümü">
        <p>
          Uyuşmazlıklarda, Ticaret Bakanlığı&apos;nca ilan edilen parasal
          sınırlar dahilinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri
          yetkilidir. ALICI, 6502 sayılı Kanun md. 68 uyarınca başvurusunu{" "}
          <strong>kendi yerleşim yerinin bulunduğu</strong> veya tüketici
          işleminin yapıldığı yerdeki Tüketici Hakem Heyetine yapabilir.
        </p>
      </Section>

      <Section title="9. Yürürlük">
        <p>
          ALICI, sipariş formunu onaylayarak işbu sözleşmeyi ve{" "}
          <Link href="/on-bilgilendirme" className="text-brand-dark underline">
            Ön Bilgilendirme Formu
          </Link>
          &apos;nu okuduğunu ve kabul ettiğini beyan eder. Sözleşme, sipariş
          kaydıyla birlikte elektronik ortamda saklanır. Sözleşme ve ön
          bilgilendirme metinlerine sipariş takip sayfanızdaki bağlantılardan
          dilediğiniz zaman erişebilirsiniz; metinlerin sürümü sipariş
          kaydınızla ilişkilendirilir.
        </p>
      </Section>
    </StaticPage>
  );
}
