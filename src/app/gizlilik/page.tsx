import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description:
    "En Yakın Halı Yıkama gizlilik politikası: çerezler, üçüncü taraflar ve verilerinizin nasıl korunduğu.",
};

export default function GizlilikPage() {
  return (
    <StaticPage
      title="Gizlilik Politikası"
      intro="Gizliliğinize saygı duyuyoruz. Bu sayfa, sitede hangi verilerin tutulduğunu ve nasıl korunduğunu sade bir dille açıklar."
    >
      <Section title="Çerezler">
        <p>
          Giriş yapan tüm hesaplar (işletme, şoför, yönetici ve varsa müşteri)
          için zorunlu bir oturum çerezi kullanılır; bu çerez sizi sayfalar
          arasında oturumda tutmaktan başka bir iş yapmaz. Altyapı/güvenlik
          sağlayıcımız (CDN), hizmetin güvenli sunumu için zorunlu teknik
          çerezler bırakabilir; analitik veya reklam/izleme çerezi{" "}
          <strong>kullanılmaz</strong>.
        </p>
      </Section>

      <Section title="Üçüncü Taraflar">
        <p>
          Verileriniz üçüncü taraf reklam ağlarıyla, sosyal medya
          platformlarıyla veya veri simsarlarıyla paylaşılmaz. Sipariş
          bilgileriniz yalnızca seçtiğiniz halıcı işletmeye ve teslimatı yapan
          şoförüne iletilir; aktarım kategorilerinin tam listesi için{" "}
          <Link href="/kvkk" className="font-medium text-brand-dark hover:underline">
            KVKK Aydınlatma Metni
          </Link>
          &apos;ne bakabilirsiniz.
        </p>
        <p>
          SMS gönderimi, harita görüntüleme ve barındırma/güvenlik (CDN) gibi
          teknik hizmetlerde kullanılan sağlayıcılara yalnızca hizmetin
          gerektirdiği asgari veri aktarılır.
        </p>
        {/* KVKK aydınlatma metnindeki (bölüm 5) yurt dışına aktarım
            açıklamasıyla tutarlı: harita karo sunucusu + IP. */}
        <p>
          Harita görüntülenirken tarayıcınız, yurt dışında yerleşik harita
          karo sunucusuna (CARTO) bağlanır ve bu sırada IP adresiniz bu
          sunucuya iletilir; ayrıntılar için KVKK Aydınlatma Metni&apos;nin
          &quot;Verilerin Aktarımı&quot; bölümüne bakabilirsiniz.
        </p>
      </Section>

      <Section title="Verilerin Korunması">
        <p>
          Tüm trafik HTTPS ile şifrelenir. Sipariş ve hesap verilerine yalnızca
          operasyon için yetkili taraflar erişebilir; şifreler geri
          döndürülemez şekilde özetlenerek (hash) saklanır.
        </p>
      </Section>

      <Section title="Takip Bağlantıları">
        <p>
          Sipariş takip bağlantınız size özeldir. Bağlantıyı paylaştığınız
          kişiler sipariş durumunuzu görebilir; bu yüzden bağlantıyı yalnızca
          güvendiğiniz kişilerle paylaşmanızı öneririz.
        </p>
      </Section>

      <Section title="Mobil Uygulamalar — Şoför Uygulaması">
        <p>
          <strong>Halı Şoför</strong> uygulaması, şoförün açıkça başlattığı{" "}
          <strong>mesai süresince</strong> cihazın <strong>hassas konum</strong>{" "}
          verisini toplar — uygulama arka plandayken veya ekran kapalıyken de.
          Mesai kapatıldığında konum toplama tamamen durur.
        </p>
        <p>
          <strong>Amaç:</strong> siparişlerin canlı takibi (müşterinin
          &quot;halım nerede&quot; ekranı), rota/durak kaydı ve teslimat
          operasyonunun yürütülmesi. Konum verisi{" "}
          <strong>yalnızca şoförün bağlı olduğu halı yıkama işletmesiyle</strong>{" "}
          paylaşılır; üçüncü taraflara satılmaz, reklam/pazarlama amacıyla
          kullanılmaz.
        </p>
        <p>
          Uygulama ayrıca giriş için ad ve kullanıcı adı bilgisini işler.
          Reklam kimliği, analitik veya çerez kullanmaz. Veriler HTTPS ile
          şifrelenerek iletilir; oturum anahtarı cihazın güvenli deposunda
          (Android Keystore / iOS Keychain) saklanır. Rota/durak kayıtları
          operasyonel amaçla saklanır ve 12 ayı aşan kayıtlar silinir. Konum
          verilerinizin silinmesini istemek için aşağıdaki iletişim adresine
          yazabilirsiniz; hesabınız işletmeniz aracılığıyla da kapatılabilir.
        </p>
      </Section>

      <Section title="İletişim">
        <p>
          Gizlilikle ilgili sorularınız için{" "}
          <a
            href="mailto:info@enyakinhaliyikamaservisi.com"
            className="font-medium text-brand-dark hover:underline"
          >
            info@enyakinhaliyikamaservisi.com
          </a>{" "}
          adresine yazabilirsiniz.
        </p>
      </Section>
    </StaticPage>
  );
}
