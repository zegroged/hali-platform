import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "Platform Aracılık ve Üyelik Sözleşmesi",
  description:
    "En Yakın Halı Yıkama platformunda listelenen işletmeler için aracılık ve üyelik sözleşmesi: hizmet kapsamı, ücretler, doğrulama, taahhütler ve fesih.",
};

// İşletmelerle (hizmet sağlayıcı) kurulan aracılık sözleşmesi.
// Dayanak: 6563 sayılı Kanun md.11 ve Elektronik Ticaret Aracı Hizmet
// Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik
// (RG 25.12.2022/32054) asgari unsurları. Kayıt akışında checkbox ile,
// mevcut hesaplarda panel üzerinden onaylanır (contractAcceptedAt).
export default function IsletmeSozlesmesiPage() {
  return (
    <StaticPage
      title="Platform Aracılık ve Üyelik Sözleşmesi"
      intro="Bu sözleşme, enyakinhaliyikamaservisi.com üzerinde listelenmek isteyen halı yıkama işletmeleri ile platform arasında, kayıt sırasında veya panel üzerinden verilen elektronik onayla kurulur. Yürürlük: 2 Temmuz 2026."
    >
      <Section title="1. Taraflar ve Hukuki Nitelik">
        <p>
          <strong>Platform:</strong> enyakinhaliyikamaservisi.com — 6563 sayılı
          Elektronik Ticaretin Düzenlenmesi Hakkında Kanun md.2/1-d anlamında{" "}
          <strong>aracı hizmet sağlayıcıdır</strong>; halı yıkama hizmetinin
          tarafı değildir. (Ticari unvan ve adres bilgileri tescil
          tamamlandığında bu bölümde yayımlanacaktır.)
        </p>
        <p>
          <strong>İşletme:</strong> Platformda profili yayımlanan, halı yıkama
          hizmetini kendi nam ve hesabına veren bağımsız{" "}
          <strong>hizmet sağlayıcıdır</strong>. Müşteriyle kurulan hizmet
          sözleşmesinin tarafı işletmedir; hizmetin ifasından, ayıptan ve
          halının korunmasından işletme sorumludur.
        </p>
      </Section>

      <Section title="2. Hizmetin Kapsamı">
        <p>Platform, işletmeye şu aracılık hizmetlerini sunar:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>İşletme profilinin (fiyat, bölge, fotoğraf) listelenmesi,</li>
          <li>Müşteri sipariş taleplerinin işletmeye iletilmesi,</li>
          <li>
            Sipariş, şoför ve fiyat yönetimi için işletme paneli sağlanması,
          </li>
          <li>
            Müşteriye adım adım sipariş takibi ve fotoğraflı teslim kanıtı
            altyapısı.
          </li>
        </ul>
      </Section>

      <Section title="3. Ücretler">
        <p>
          Yönetici (admin) onayının tamamlanmasından itibaren ilk{" "}
          <strong>30 gün ücretsiz deneme</strong> dönemidir. Deneme süresinin
          ardından aylık abonelik bedeli <strong>2.000 TL/ay</strong>&apos;dır.
          Müşteri siparişlerinden ayrıca komisyon alınmaz.
        </p>
        <p>
          Online kartlı ödeme tahsilatı aktif hâle geldiğinde uygulanacak
          işlem ücreti ve/veya komisyon oranları, yürürlüğe girmeden önce
          ayrıca duyurulur ve işletmenin onayına bağlıdır; onaylanmadıkça
          işletmeye uygulanmaz.
        </p>
      </Section>

      <Section title="4. Doğrulama ve Görünürlük">
        <p>
          İşletmenin müşterilere görünür olması şu adımların tamamına
          bağlıdır: vergi kimlik numarası beyanı, e-posta doğrulaması, eksiksiz
          profil (fiyat, hizmet bölgesi, iletişim), bu sözleşmenin onayı ve
          yönetici onayı. Platform, işletmenin tanıtıcı bilgilerini (unvan,
          vergi no, iletişim) doğrulama ve profilde yayımlatma hakkına
          sahiptir (ETAHS Yönetmeliği, RG 25.12.2022/32054).
        </p>
        <p>
          Görünürlük şartlarından biri sonradan eksilirse (örn. profil
          bilgisinin silinmesi) işletme profili otomatik olarak gizlenir.
          Platform kurallarına, bu sözleşmeye veya mevzuata aykırılık
          hâlinde işletme hesabı, aykırılık giderilene kadar askıya
          alınabilir; askıya alma gerekçesi işletmeye panel veya e-posta
          yoluyla bildirilir.
        </p>
      </Section>

      <Section title="5. İşletmenin Taahhütleri">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Profilde yayımlanan ilan, fiyat ve hizmet bilgilerinin{" "}
            <strong>doğruluğu münhasıran işletmenin sorumluluğundadır</strong>.
            Yanlış veya yanıltıcı bilgiden doğan idari yaptırım, tazminat veya
            müşteri zararı nedeniyle platform bir ödeme yapmak zorunda
            kalırsa, ödenen tutar için işletmeye <strong>rücu hakkı</strong>{" "}
            saklıdır.
          </li>
          <li>
            İşletme, platform üzerinden edindiği müşteri verilerini (ad,
            telefon, adres){" "}
            <strong>yalnızca ilgili siparişin ifası için</strong> kullanır;
            pazarlama dâhil başka amaçla işleyemez, üçüncü kişilerle
            paylaşamaz (6698 sayılı KVKK).
          </li>
          <li>
            İşletme, panele eklediği şoförlerini, teslimat sırasında anlık
            konumlarının işlendiği ve aktif siparişin müşterisine gösterildiği
            konusunda bilgilendirmekle yükümlüdür.
          </li>
          <li>
            İşletme, hizmeti mevzuata uygun, taahhüt ettiği sürede ve özenle
            ifa eder; alım ve teslim anlarını fotoğrafla belgeleyen platform
            akışına uyar.
          </li>
        </ul>
      </Section>

      <Section title="6. Hizmet Kesintileri">
        <p>
          Platform, planlı bakım ve güncelleme çalışmalarını mümkün olduğunca
          düşük yoğunluklu saatlerde yapar ve öngörülebilir kesintileri
          işletmeye panel veya e-posta yoluyla önceden bildirir. Plansız
          teknik arızalarda kesinti en kısa sürede giderilir ve işletme
          bilgilendirilir.
        </p>
      </Section>

      <Section title="7. Sözleşme Değişiklikleri">
        <p>
          Platform bu sözleşmede değişiklik yapabilir; esaslı değişiklikler
          yürürlüğe girmeden önce işletmeye e-posta ve/veya panel bildirimi
          ile duyurulur. Değişikliği kabul etmeyen işletme, değişiklik
          yürürlüğe girene kadar sözleşmeyi tazminatsız feshedebilir;
          bildirilen sürenin sonunda platformu kullanmaya devam etmek
          değişikliğin kabulü sayılır.
        </p>
      </Section>

      <Section title="8. Fesih">
        <p>
          İşletme, panel üzerinden veya{" "}
          <Link
            href="/iletisim"
            className="font-medium text-brand-dark hover:underline"
          >
            iletişim
          </Link>{" "}
          kanallarından bildirimde bulunarak üyeliğini her zaman
          sonlandırabilir; fesih, devam eden (kabul edilmiş) siparişlerin
          ifasını etkilemez. Platform, bu sözleşmeye veya mevzuata esaslı
          aykırılık hâlinde sözleşmeyi gerekçesini bildirerek feshedebilir.
          Fesih tarihine kadar tahakkuk etmiş abonelik bedelleri muaccel
          kalır; kullanılmayan döneme ilişkin peşin ödeme varsa iade edilir.
        </p>
      </Section>

      <Section title="9. Delil Sözleşmesi">
        <p>
          Taraflar; platformun veritabanı kayıtlarının, sipariş ve onay
          loglarının, panel işlem kayıtlarının ve sistem tarafından üretilen
          elektronik kayıtların, bu sözleşmeden doğan uyuşmazlıklarda 6100
          sayılı HMK md.193 anlamında <strong>kesin delil</strong> teşkil
          edeceğini kabul eder.
        </p>
      </Section>

      <Section title="10. Uygulanacak Hukuk ve Yetkili Mahkeme">
        <p>
          Bu sözleşme Türkiye Cumhuriyeti hukukuna tabidir. Sözleşmeden doğan
          uyuşmazlıklarda <strong>İstanbul (Çağlayan) Mahkemeleri ve İcra
          Daireleri</strong> yetkilidir. Bu sözleşme işletme ile platform
          arasındaki ticari ilişkiyi düzenler; müşterilerin tüketici
          mevzuatından doğan hakları saklıdır.
        </p>
      </Section>
    </StaticPage>
  );
}
