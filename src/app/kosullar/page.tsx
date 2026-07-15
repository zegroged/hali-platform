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
      intro="Bu koşullar, enyakinhaliyikamaservisi.com üzerinden sipariş oluşturan müşteriler ile platformda listelenen işletmeler için geçerlidir. Sipariş oluştururken veya kayıt olurken bu koşulları elektronik onayınızla kabul edersiniz."
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
          Halının alınması, taşınması, yıkanması, saklanması, korunması ve
          tesliminden <strong>hizmeti veren işletme</strong> sorumludur; işletme
          bu hizmeti kendi nam ve hesabına sunan bağımsız hizmet sağlayıcıdır.
          Platform, halı yıkama hizmetinin tarafı değildir ve hizmetin
          sonucundan (yıkama kalitesi, hasar, kayıp) doğrudan sorumlu tutulamaz.
        </p>
        <p>
          Bununla birlikte Platform; işletmeyi doğrulamak, işletmenin ticari
          unvanı, adresi ve iletişim bilgisini sipariş akışında ve takip
          sayfasında <strong>eksiksiz göstermek</strong>, doğru tanıtım yapmak
          ve tüketici bildirimlerini (iptal, cayma, hasar, şikâyet) gecikmeksizin
          işletmeye iletmek yükümlülüklerini üstlenir. Müşteri, siparişin her
          aşamasında hizmeti veren işletmeye doğrudan ulaşabilir. Platform bu
          kendi yükümlülüklerini ihmal ederse (örneğin işletmenin kimlik/iletişim
          bilgisini erişilebilir sunmaması ya da bildirimi işletmeye iletmemesi),{" "}
          <strong>yalnızca bu ihmalinden doğan zarardan</strong> sorumlu olabilir
          (6563 sayılı Kanun md.9; Anayasa Mahkemesi&apos;nin E.2024/187,
          K.2026/42 sayılı kararıyla md.9/1&apos;in tüketici sözleşmeleri yönünden
          iptali — yürürlük 2 Mart 2027; 6502 sayılı Kanun md.48).
        </p>
        <p>
          Uygulamada gösterilen &quot;Doğrulanmış İşletme&quot; işareti yalnızca
          işletmenin kimlik ve iletişim bilgilerinin doğrulandığını gösterir;
          hizmet kalitesine ilişkin bir taahhüt veya Platform&apos;un hizmeti
          bizzat verdiği anlamına gelmez. Tüketicilerin 6502 sayılı Kanun&apos;dan
          doğan hakları her hâlde saklıdır; işbu koşulların hiçbir hükmü
          tüketicinin yasal haklarını sınırlayacak veya kaldıracak biçimde
          yorumlanamaz (6502 sayılı Kanun md.5).
        </p>
      </Section>

      <Section title="5/A. Ayıplı Hizmette Haklarınız">
        <p>
          Halı yıkama, sonucunda temizlenmiş bir eser (halı) meydana getiren bir
          hizmettir; hem 6502 sayılı Kanun&apos;un ayıplı hizmet hükümlerine hem
          de 6098 sayılı Türk Borçlar Kanunu&apos;nun eser sözleşmesi hükümlerine
          tabidir. Teslim aldığınız halı taşıması gereken özellikleri taşımıyorsa
          (leke çıkmaması, renk akması, boyut değişimi/çekme, yırtılma, hasar,
          kayıp vb.) hizmet ayıplıdır ve aşağıdaki{" "}
          <strong>seçimlik haklardan</strong> dilediğinizi kullanabilirsiniz;
          işletme bunu yerine getirmek zorundadır:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>hizmetin ücretsiz yeniden görülmesi (halının yeniden yıkanması),</li>
          <li>hizmet sonucu ortaya çıkan eserin ücretsiz onarımı,</li>
          <li>ayıp oranında bedelden indirim,</li>
          <li>sözleşmeden dönerek ödenen bedelin iadesi.</li>
        </ul>
        <p>
          Yeniden yıkama veya onarım, talep tarihinden itibaren{" "}
          <strong>en geç 30 iş günü</strong> içinde ve doğan tüm masraflar
          (halının yeniden alınıp götürülmesi dâhil){" "}
          <strong>işletmeye ait olacak şekilde</strong> yapılır. Bu seçimlik
          hakların yanında, halının hasar görmesi, değer kaybetmesi veya
          kaybolması hâlinde halının <strong>rayiç değeri</strong> ve şartları
          varsa dolaylı zararlarınız için ayrıca tazminat isteme hakkınız
          saklıdır (6502 sayılı Kanun md.15; 6098 sayılı Kanun md.112).
        </p>
      </Section>

      <Section title="5/B. Hasar / Kayıp / Kötü Yıkama Çözüm Süreci">
        <p>
          Hasar, kayıp veya kötü yıkama iddialarında aşağıdaki çözüm süreci
          uygulanır:
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Durumu, takip sayfası üzerinden veya{" "}
            <strong>info@enyakinhaliyikamaservisi.com</strong> adresinden
            Platform&apos;a bildirirsiniz; başvuru için hak düşürücü bir süre
            öngörülmez.
          </li>
          <li>
            Platform başvuruyu gecikmeksizin işletmeye iletir; halının alım anında
            (öncesi) ve teslim anında (sonrası) çekilen fotoğrafları ile sipariş
            kayıtları objektif delil olarak karşılaştırılır.
          </li>
          <li>
            İşletme, başvuru kendisine iletildikten sonra{" "}
            <strong>en geç 5 iş günü</strong> içinde 5/A maddesindeki talebinizi
            karşılamak üzere çözüm önerisini sunar.
          </li>
          <li>
            Uzlaşılamazsa Platform, <strong>en geç 15 gün</strong> içinde
            başvuruyu değerlendirip sonucu size ve işletmeye bildirir.
          </li>
          <li>
            Bu aşamaların hiçbiri, yerleşim yerinizdeki veya işlemin yapıldığı
            yerdeki Tüketici Hakem Heyeti ile Tüketici Mahkemesi&apos;ne ve dava
            şartı arabuluculuğa başvurma hakkınızı ortadan kaldırmaz.
          </li>
        </ol>
        <p>
          Halının durumu alım ve teslim anlarında fotoğrafla kayıt altına alınır
          ve hasar/kayıp değerlendirmesi öncelikle bu kayıtlara göre yapılır;
          ancak bu kayıtlar münhasır delil değildir, her türlü yasal delille
          ispat hakkınız saklıdır (6502 sayılı Kanun md.48; 6100 sayılı HMK
          md.193).
        </p>
      </Section>

      <Section title="5/C. Fotoğraflı Güvence">
        <p>
          Platform üzerinden verilen siparişlerde halınızın durumu,{" "}
          <strong>alım (yıkama öncesi) ve teslim (yıkama sonrası) anlarında
          fotoğrafla kayıt altına alınır</strong>. Hasar, kayıp veya kötü yıkama
          hâlinde zarar; bu fotoğraf kayıtları esas alınarak, işletmenin
          sorumluluğu kapsamında yukarıdaki 5/B çözüm süreciyle karşılanır. Bu
          düzenleme bir sigorta poliçesi değildir; Platform &quot;sigortalı&quot;
          güvencesi vermez, süreç işletmenin yasal sorumluluğu üzerinden işler.
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
          önceden bildirimde bulunarak{" "}
          <strong>askıya alabilir veya sona erdirebilir</strong>. İşletme ve
          şoför hesapları bakımından önceden bildirim yapılmaksızın{" "}
          <strong>derhâl</strong> askıya alma yalnızca; mevzuattan kaynaklanan
          sebepler, kamu düzeninin korunması, gecikmesinde sakınca bulunan
          hâller ile dolandırıcılık, veri ihlali veya diğer siber güvenlik
          riski şüphesi hâlleriyle sınırlıdır (ETAHS Yönetmeliği md.17/7).
          Askıya alma,
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
          eder. Bu kayıtlar <strong>münhasır delil değildir</strong>;
          tüketicinin her türlü yasal delille ispat hakkı saklıdır (6100
          sayılı HMK md.193/2; 6502 sayılı Kanun md.5).
        </p>
        <p>
          Halının alım (yıkama öncesi) ve teslim (yıkama sonrası) fotoğrafları,
          ayıp/hasar/kayıp tespitinde esas delil olarak kullanılır. İşletme,
          halıyı teslim aldığı andan geri teslime kadar özenle korumakla
          yükümlüdür; halının bu süreçte kaybolması, hasar görmesi veya değer
          kaybetmesi hâlinde zararın kendi kusuru olmaksızın gerçekleştiğini{" "}
          <strong>ispat yükü işletmededir</strong> (6098 sayılı Kanun md.112 ve
          md.471). Ayıplı hizmetten doğan talepler, hizmetin ifasından itibaren{" "}
          <strong>iki yıllık zamanaşımına</strong> tabidir; ayıbın işletmenin
          ağır kusuru veya hilesiyle gizlenmesi hâlinde zamanaşımı süresi
          işlemez (6502 sayılı Kanun md.16).
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
          Bu koşullar ancak haklı sebeplerle güncellenebilir; metin
          güncellendiğinde tarihli yeni sürüm bu sayfada yayımlanır.
          Değişiklikler <strong>geçmişe yürümez</strong>; yalnızca yayımdan
          sonra oluşturulan siparişlere uygulanır. Mevcut siparişlere, onay
          anında yürürlükte olan ve sipariş kaydınızla ilişkilendirilen sürüm
          uygulanır (6502 sayılı Kanun md.4/2). Yürürlükteki sürüm:{" "}
          <strong>{CONTRACT_VERSION}</strong>. Sorularınız için{" "}
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

      <p className="text-sm text-slate-500">Yürürlük: {CONTRACT_VERSION}</p>
    </StaticPage>
  );
}
