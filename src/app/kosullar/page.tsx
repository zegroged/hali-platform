import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "Kullanım Koşulları",
  description:
    "En Yakın Halı Yıkama kullanım koşulları: platformun rolü, fiyatlandırma, ödeme ve sorumluluk sınırları.",
};

export default function KosullarPage() {
  return (
    <StaticPage
      title="Kullanım Koşulları"
      intro="Bu koşullar, enyakinhaliyikamaservisi.com üzerinden sipariş oluşturan müşteriler ile platformda listelenen işletmeler için geçerlidir."
    >
      <Section title="1. Platformun Rolü">
        <p>
          En Yakın Halı Yıkama bir <strong>pazar yeri / aracı platformdur</strong>.
          Halı yıkama hizmetinin kendisi, platformda listelenen bağımsız halıcı
          işletmeler tarafından verilir. Platform; sipariş talebinizi seçtiğiniz
          işletmeye iletir, süreci adım adım takip etmenizi sağlar.
        </p>
      </Section>

      <Section title="2. Fiyatlandırma">
        <p>
          Profillerde görünen fiyatlar işletmelerin beyanıdır ve tahmini
          niteliktedir. Kesin fiyat, halınız alınıp görüldükten sonra işletme
          tarafından netleştirilir. Fiyatı beğenmezseniz halınız yıkanmadan
          ücretsiz iade edilir.
        </p>
      </Section>

      <Section title="3. Ödeme">
        <p>
          Ödeme <strong>teslimatta</strong>, doğrudan hizmeti veren halıcı
          işletmeye yapılır. Platform müşteriden ön ödeme, kapora veya komisyon
          almaz; sipariş oluşturmak ücretsizdir.
        </p>
      </Section>

      <Section title="4. Sorumluluk Sınırı">
        <p>
          Halının alınması, yıkanması, korunması ve tesliminden hizmeti veren
          işletme sorumludur. Platform, işletmeleri doğrulamak ve süreç
          şeffaflığını sağlamak için makul özeni gösterir; ancak hizmetin
          sonucuna ilişkin doğrudan taraf değildir. Hasar/kayıp durumlarında
          müşteri ile işletme arasındaki çözüme aracılık ederiz.
        </p>
      </Section>

      <Section title="5. İptal ve Ret">
        <p>
          Halınız alınmadan önce siparişinizi telefonla veya işletme üzerinden
          iptal edebilirsiniz. İşletmeler yoğunluk veya kapsama alanı nedeniyle
          talebi reddedebilir; bu durumda takip sayfanızda bilgilendirilirsiniz.
        </p>
      </Section>

      <Section title="6. Kötüye Kullanım">
        <p>
          Gerçek olmayan sipariş talepleri, platformdaki işletmelere veya diğer
          kullanıcılara zarar veren davranışlar tespit edildiğinde ilgili
          erişim kısıtlanabilir.
        </p>
      </Section>

      <Section title="7. Değişiklikler ve İletişim">
        <p>
          Bu koşullar gerektiğinde güncellenebilir; güncel sürüm her zaman bu
          sayfada yayınlanır. Sorularınız için{" "}
          <Link href="/iletisim" className="font-medium text-brand-dark hover:underline">
            iletişim sayfamızı
          </Link>{" "}
          kullanabilirsiniz. Kişisel verilerle ilgili ayrıntılar{" "}
          <Link href="/kvkk" className="font-medium text-brand-dark hover:underline">
            KVKK Aydınlatma Metni
          </Link>
          &apos;nde yer alır.
        </p>
      </Section>
    </StaticPage>
  );
}
