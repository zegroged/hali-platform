import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";
import { CONTRACT_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Kullanım Koşulları",
  description:
    "En Yakın Halı Yıkama kullanım koşulları: tanımlar, platformun rolü, fiyatlandırma, ödeme, sorumluluk sınırları, kayıtların delil niteliği ve uyuşmazlık çözümü.",
};

export default function KosullarPage() {
  return (
    <StaticPage
      title="Kullanım Koşulları"
      intro="Bu koşullar, enyakinhaliyikamaservisi.com üzerinden sipariş oluşturan müşteriler ile platformda listelenen işletmeler için geçerlidir. Siteyi kullanarak bu koşulları okuduğunuzu ve kabul ettiğinizi beyan etmiş olursunuz."
    >
      <Section title="1. Tanımlar">
        <p>Bu metinde geçen kavramlar aşağıdaki anlamlarda kullanılır:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Platform:</strong> enyakinhaliyikamaservisi.com alan adında
            faaliyet gösteren, halı yıkama hizmeti veren işletmeler ile
            müşterileri buluşturan &quot;En Yakın Halı Yıkama&quot; pazar yeri
            (6563 sayılı Kanun anlamında aracı hizmet sağlayıcı).
          </li>
          <li>
            <strong>Müşteri:</strong> Platform üzerinden halı yıkama hizmeti
            için sipariş talebi oluşturan gerçek veya tüzel kişi.
          </li>
          <li>
            <strong>İşletme (Halıcı):</strong> Platformda listelenen, halı
            yıkama hizmetini fiilen sunan bağımsız halı yıkama işletmesi (6563
            sayılı Kanun anlamında hizmet sağlayıcı).
          </li>
          <li>
            <strong>Şoför:</strong> İşletme adına halının alım ve teslimatını
            gerçekleştiren, İşletme tarafından platforma tanımlanan görevli.
          </li>
        </ul>
      </Section>

      <Section title="2. Platformun Rolü">
        <p>
          En Yakın Halı Yıkama bir <strong>pazar yeri / aracı platformdur</strong>.
          Halı yıkama hizmetinin kendisi, platformda listelenen bağımsız halıcı
          işletmeler tarafından verilir. Platform; sipariş talebinizi seçtiğiniz
          işletmeye iletir, süreci adım adım takip etmenizi sağlar.
        </p>
      </Section>

      <Section title="3. Fiyatlandırma">
        <p>
          Profillerde görünen fiyatlar işletmelerin beyanıdır ve tahmini
          niteliktedir. Kesin fiyat, halınız alınıp görüldükten sonra işletme
          tarafından netleştirilir. Fiyatı beğenmezseniz halınız yıkanmadan
          ücretsiz iade edilir.
        </p>
      </Section>

      <Section title="4. Ödeme">
        <p>
          Ödeme <strong>teslimatta</strong>, doğrudan hizmeti veren halıcı
          işletmeye yapılır (online kart ödemesi aktif olduğunda tahsilat,
          ödeme kuruluşu aracılığıyla işletme nam ve hesabına platform
          üzerinden yapılır). Platform müşteriden ön ödeme, kapora veya
          komisyon almaz; sipariş oluşturmak ücretsizdir.
        </p>
      </Section>

      <Section title="5. Sorumluluk Sınırı">
        <p>
          Halının alınması, yıkanması, korunması ve tesliminden hizmeti veren
          işletme sorumludur. Platform, işletmeleri doğrulamak ve süreç
          şeffaflığını sağlamak için makul özeni gösterir; ancak hizmetin
          sonucuna ilişkin doğrudan taraf değildir. Hasar/kayıp durumlarında
          müşteri ile işletme arasındaki çözüme aracılık ederiz. Tüketicilerin
          6502 sayılı Tüketicinin Korunması Hakkında Kanun&apos;dan doğan
          hakları saklıdır.
        </p>
      </Section>

      <Section title="6. İptal ve Ret">
        <p>
          Halınız alınmadan önce siparişinizi telefonla veya işletme üzerinden
          iptal edebilirsiniz. İşletmeler yoğunluk veya kapsama alanı nedeniyle
          talebi reddedebilir; bu durumda takip sayfanızda bilgilendirilirsiniz.
          İptal ve cayma hakkına ilişkin ayrıntılar{" "}
          <Link href="/iade" className="font-medium text-brand-dark hover:underline">
            İptal ve İade
          </Link>{" "}
          sayfasında yer alır.
        </p>
      </Section>

      <Section title="7. Kötüye Kullanım">
        <p>
          Gerçek olmayan sipariş talepleri, platformdaki işletmelere veya diğer
          kullanıcılara zarar veren davranışlar tespit edildiğinde ilgili
          erişim kısıtlanabilir.
        </p>
      </Section>

      <Section title="8. Erişimin Kısıtlanması ve Fesih">
        <p>
          Platform; kötüye kullanım, sahte veya yanıltıcı sipariş oluşturma,
          işbu koşullara ya da yürürlükteki mevzuata aykırı davranış tespit
          ettiğinde, ilgili müşteri erişimini veya işletme/şoför hesabını
          önceden bildirimde bulunarak ya da ağır ihlal hâllerinde derhâl{" "}
          <strong>askıya alabilir veya sona erdirebilir</strong>. Askıya alma,
          devam eden siparişlerden doğan hak ve borçları ortadan kaldırmaz.
          Platformun, ihlal nedeniyle uğradığı zararların tazminini talep etme
          ve yasal yollara başvurma hakkı saklıdır.
        </p>
      </Section>

      <Section title="9. Kayıtların Delil Niteliği">
        <p>
          Taraflar; Platform&apos;un veritabanında ve sistemlerinde tutulan
          sipariş kayıtlarının, sipariş durum olaylarının (zaman damgalı işlem
          geçmişi), siparişe eklenen fotoğrafların, SMS ve e-posta gönderim
          loglarının ve ön bilgilendirme/sözleşme onaylarına ilişkin zaman
          damgası ile metin sürümü kayıtlarının; işbu koşullardan ve platform
          üzerinden kurulan sözleşmelerden doğabilecek uyuşmazlıklarda{" "}
          <strong>
            6100 sayılı Hukuk Muhakemeleri Kanunu md.193 anlamında delil
            sözleşmesi
          </strong>{" "}
          niteliğinde olduğunu ve geçerli delil olarak kabul edileceğini kabul
          eder.
        </p>
      </Section>

      <Section title="10. Fikri Mülkiyet">
        <p>
          Sitenin tasarımı, &quot;En Yakın Halı Yıkama&quot; markası ve logosu,
          arayüz, metinler, görseller, yazılım ve veritabanı dâhil tüm içerik
          Platform&apos;a aittir ve 5846 sayılı Fikir ve Sanat Eserleri Kanunu
          ile 6769 sayılı Sınai Mülkiyet Kanunu kapsamında korunur. Bu
          içerikler Platform&apos;un yazılı izni olmadan kopyalanamaz,
          çoğaltılamaz, işlenemez ve ticari amaçla kullanılamaz. İşletme
          profillerinde yer alan fotoğraf ve beyanların içeriğinden ilgili
          işletme sorumludur.
        </p>
      </Section>

      <Section title="11. Uygulanacak Hukuk ve Yetkili Merci">
        <p>
          İşbu koşullar ve platform üzerinden kurulan ilişkiler{" "}
          <strong>Türk hukukuna</strong> tabidir. Tüketici işlemlerinden doğan
          uyuşmazlıklarda müşterinin, 6502 sayılı Kanun uyarınca kendi
          yerleşim yerindeki veya tüketici işleminin yapıldığı yerdeki{" "}
          <strong>Tüketici Hakem Heyeti&apos;ne ve Tüketici Mahkemesi&apos;ne</strong>{" "}
          başvurma hakları saklıdır. Bunun dışında kalan uyuşmazlıklarda
          (özellikle Platform ile işletmeler arasındaki ilişkiden doğanlarda)
          İstanbul mahkemeleri ve icra daireleri yetkilidir.
        </p>
      </Section>

      <Section title="12. Değişiklikler ve İletişim">
        <p>
          Bu koşullar gerektiğinde güncellenebilir; metin güncellendiğinde
          tarihli yeni sürüm bu sayfada yayımlanır ve yayım anından itibaren
          geçerli olur. Yürürlükteki sürüm: <strong>{CONTRACT_VERSION}</strong>.
          Sorularınız için{" "}
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
