import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";
import { CONTRACT_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Ön Bilgilendirme Formu",
  description:
    "Mesafeli Sözleşmeler Yönetmeliği uyarınca sipariş öncesi ön bilgilendirme formu.",
};

// Künye işlendi (2026-07-02, vergi levhasından). Kalan: telefon + KEP (varsa).
// TODO(iyzico): Ödeme kuruluşu sözleşmesi imzalanınca §3'teki "anlaşmalı
// ödeme kuruluşu" ifadesi marka adıyla (iyzico) güncellenecek.
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
          telefonu sipariş takip sayfanızda yer alır. Seçtiğiniz işletmenin
          açık adresi, telefonu ve vergi kimlik numarası, sipariş vermeden
          önce işletmenin profil sayfasında yer alır (Mesafeli Sözleşmeler
          Yönetmeliği md. 5/1-b ve 5/1-c).
        </p>
        <p>
          Platform işleticisi (aracı hizmet sağlayıcı):{" "}
          <strong>[YASAL AD]</strong> (şahıs işletmesi). Adres:
          [ADRES], Selçuklu/Konya. Vergi
          Dairesi/No: Meram / [VKN]. KEP:
          [KEP]. İletişim:
          info@enyakinhaliyikamaservisi.com.
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
          olduğunda anlaşmalı ödeme kuruluşu aracılığıyla kartla da
          ödeyebilirsiniz; olası ek bedeller ödeme adımında ayrıca
          gösterilir).
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
          Yasal cayma süreniz, sözleşmenin kurulduğu günden itibaren{" "}
          <strong>14 gündür</strong> (Mesafeli Sözleşmeler Yönetmeliği md. 9).
          Uygulamamız bundan daha lehinizedir: halı alınmadan her an ücretsiz
          iptal, kesin fiyatı onaylamadığınız sürece ücretsiz iade hakkınız
          vardır; kesin fiyat onayınızla yıkamaya başlandığında md. 15/1-h
          istisnası uygulanır.
        </p>
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
          şu kanallardan yapabilirsiniz: sipariş takip sayfanızdaki{" "}
          <strong>&quot;Siparişi iptal et&quot; butonu</strong> (halınız teslim
          alınana kadar), takip sayfanızda görünen{" "}
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
          edersiniz; (4) talebi oluşturursunuz; (5) sipariş sonunda size
          gösterilen takip linkinden (e-posta adresinizi verdiyseniz ayrıca
          e-postayla da iletilir) süreci adım adım izlersiniz. Sözleşme ve ön bilgilendirme
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
        <p>
          Tüketici Hakem Heyeti (THH) parasal sınırının üzerindeki
          uyuşmazlıklarda, Tüketici Mahkemesinde dava açmadan önce arabulucuya
          başvurulması dava şartıdır (6502 sayılı Kanun md. 73/A). 2026 yılı
          için THH parasal sınırı 186.000 TL&apos;dir (RG 23.12.2025/33116).
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

      <p className="text-sm text-slate-500">Yürürlük: {CONTRACT_VERSION}</p>
    </StaticPage>
  );
}
