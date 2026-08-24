import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";
import { CONTRACT_VERSION } from "@/lib/legal";
import { SIRKET, vergiSatiri } from "@/lib/sirket";

export const metadata: Metadata = {
  title: "Mesafeli Satış Sözleşmesi",
  description:
    "En Yakın Halı Yıkama üzerinden verilen siparişlerde geçerli mesafeli satış sözleşmesi.",
};

// Künye işlendi (2026-07-02, vergi levhasından — şahıs işletmesi, MERSİS yok).
// TODO(iyzico): Ödeme kuruluşu sözleşmesi imzalanınca §3'teki "anlaşmalı
// ödeme kuruluşu" ifadesi marka adıyla (iyzico) güncellenecek.
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
          enyakinhaliyikamaservisi.com — işleticisi{" "}
          <strong>{SIRKET.yasalAd}</strong> ({SIRKET.isletmeTuru}). Adres:{" "}
          {SIRKET.adres} · Vergi Dairesi/No: {vergiSatiri}. KEP:{" "}
          {SIRKET.kep}. İletişim: {SIRKET.eposta} (
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
          kartlı ödeme aktif edildiğinde tahsilat, anlaşmalı ödeme kuruluşu
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
        <p>
          İşletme, halının alınmasından itibaren profilinde taahhüt ettiği
          azami süre içinde ifa eder; taahhüt edilen sürede ifa edilmezse
          ALICI sözleşmeyi feshedebilir (6502 sayılı Kanun md. 48/3).
        </p>
      </Section>

      <Section title="5. Cayma Hakkı">
        <p>
          ALICI&apos;nın yasal cayma süresi, sözleşmenin kurulduğu günden
          itibaren <strong>14 gündür</strong> (Mesafeli Sözleşmeler
          Yönetmeliği md. 9). Uygulamamız bundan daha lehinizedir: halı
          alınmadan her an ücretsiz iptal, kesin fiyatı onaylamadığınız
          sürece ücretsiz iade hakkınız vardır; kesin fiyat onayınızla
          yıkamaya başlandığında md. 15/1-h istisnası uygulanır.
        </p>
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

      <Section title="6. Kusurlu (Ayıplı) İfa">
        <p>
          Kusuru fark eder etmez bildirmenizi öneririz — bu bir{" "}
          <strong>hak düşürücü süre değildir</strong>; ayıplı hizmete ilişkin
          yasal haklarınız hizmetin ifasından itibaren <strong>iki yıl</strong>{" "}
          (ağır kusur veya hile ile gizlenmiş ayıpta süresiz) saklıdır (6502
          sayılı Kanun md.16). Ayıplı hizmette <strong>seçiminize bağlı
          olarak</strong>: hizmetin yeniden görülmesi, ayıp oranında bedel
          indirimi, eserin ücretsiz onarımı veya sözleşmeden dönerek bedel
          iadesi haklarına sahipsiniz. Yeniden yıkama/onarım, talep tarihinden
          itibaren <strong>en geç 30 iş günü</strong> içinde ve masrafı işletmeye
          ait olacak şekilde yapılır (6502 sayılı Kanun md.15). Halının hasar
          görmesi veya kaybolması hâlinde, seçimlik haklarınızın yanında halının
          <strong> rayiç değeri</strong> üzerinden tazminat isteme hakkınız
          saklıdır (6098 sayılı Kanun md.112).
        </p>
        <p>
          Bildiriminiz, Kullanım Koşulları&apos;nda tanımlanan çözüm süreciyle
          değerlendirilir: Platform başvuruyu işletmeye iletir, halının alım ve
          teslim fotoğrafları esas alınır, işletme en geç{" "}
          <strong>5 iş günü</strong> içinde çözüm sunar, uzlaşılamazsa Platform
          en geç <strong>15 gün</strong> içinde sonucu bildirir. Bu süreç,
          Tüketici Hakem Heyeti / Tüketici Mahkemesi ve arabuluculuk yollarına
          başvurma hakkınızı sınırlamaz.
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
        <p>
          Tüketici Hakem Heyeti (THH) parasal sınırının üzerindeki
          uyuşmazlıklarda, Tüketici Mahkemesinde dava açmadan önce arabulucuya
          başvurulması dava şartıdır (6502 sayılı Kanun md. 73/A). 2026 yılı
          için THH parasal sınırı 186.000 TL&apos;dir (RG 23.12.2025/33116).
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

      <p className="text-sm text-slate-500">Yürürlük: {CONTRACT_VERSION}</p>
    </StaticPage>
  );
}
