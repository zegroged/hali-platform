import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";
import { CONTRACT_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Platform Aracılık ve Üyelik Sözleşmesi",
  description:
    "En Yakın Halı Yıkama platformunda listelenen işletmeler için aracılık ve üyelik sözleşmesi: hizmet kapsamı, sıralama ölçütleri, ücretler, doğrulama ve askıya alma usulü, şikâyet süreçleri, değişiklik ve fesih.",
};

// İşletmelerle (hizmet sağlayıcı) kurulan aracılık sözleşmesi.
// Dayanak: 6563 sayılı Kanun md.11 ve Elektronik Ticaret Aracı Hizmet
// Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik
// (RG 29.12.2022/32058, 8.3.2025 değişik) md.15 asgari unsurları ile
// md.10, 12-14, 16, 17 ve 18 usul hükümleri. Kayıt akışında checkbox ile,
// mevcut hesaplarda panel üzerinden onaylanır (contractAcceptedAt +
// contractVersion).
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
          tarafı değildir. İşletici: <strong>[YASAL AD]</strong> (şahıs
          işletmesi), [ADRES],
          Selçuklu/Konya · Vergi Dairesi/No: Meram / [VKN].
        </p>
        <p>
          <strong>İşletme:</strong> Platformda profili yayımlanan, halı yıkama
          hizmetini kendi nam ve hesabına veren bağımsız{" "}
          <strong>hizmet sağlayıcıdır</strong>. Müşteriyle kurulan hizmet
          sözleşmesinin tarafı işletmedir; hizmetin ifasından, ayıptan ve
          halının korunmasından işletme sorumludur.
        </p>
      </Section>

      <Section title="2. Hizmetin Kapsamı ve Sıralama Ölçütleri">
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
        <p>
          <strong>Sıralama:</strong> İşletmeler müşteriye; müşterinin konumuna
          / hizmet bölgesine göre <strong>uzaklık</strong>,{" "}
          <strong>profil eksiksizliği</strong> ve{" "}
          <strong>müşteri puanı</strong> ölçütlerine göre sıralanarak
          gösterilir; öncelik sırası bu şekildedir. Sıralamada veya tavsiyede
          öne çıkarma karşılığında işletmelerden doğrudan ya da dolaylı hiçbir
          bedel alınmaz (ETAHS Yönetmeliği md.11/2-e ve md.15/1-ç).
        </p>
      </Section>

      <Section title="3. Ücretler ve Ödemelerin Aktarımı">
        <p>
          Aylık abonelik bedeli <strong>2.000 TL + KDV</strong>&apos;dir ve
          kayıt sırasında peşin tahsil edilir. Abonelik, bedelin ödenmesiyle
          başlar; ödemesi alınmayan işletme yayına alınmaz. Bedel karşılığında
          e-arşiv fatura düzenlenir. Müşteri siparişlerinden ayrıca komisyon
          alınmaz.
        </p>
        <p>
          Online kartlı ödeme tahsilatı aktif hâle geldiğinde sipariş bedeli;
          bedelin platformun (ödeme kuruluşunun) tasarrufuna girdiği ve
          hizmetin tamamlandığı tarihten itibaren{" "}
          <strong>en geç 5 iş günü içinde</strong> işletmeye eksiksiz aktarılır
          (ETAHS Yönetmeliği md.15/1-d). Bu durumda uygulanacak işlem ücreti
          ve/veya komisyon oranları, yürürlüğe girmeden önce ayrıca duyurulur
          ve işletmenin onayına bağlıdır; onaylanmadıkça işletmeye uygulanmaz.
        </p>
      </Section>

      <Section title="4. Doğrulama, Görünürlük ve Askıya Alma">
        <p>
          İşletme profili; vergi kimlik numarası beyanı, e-posta doğrulaması,
          eksiksiz profil (fiyat, hizmet bölgesi, teslim süresi, fotoğraf,
          çalışma saatleri), en az bir şoför kaydı, bu sözleşmenin onayı ve
          abonelik bedelinin ödenmesi şartlarının <strong>tamamı</strong>{" "}
          sağlandığında <strong>kendiliğinden (otomatik) yayına alınır</strong>;
          ayrıca bir yönetici onayı beklenmez. Platform, işletmenin tanıtıcı
          bilgilerini (unvan, vergi no, iletişim) ilgili kurumların erişime
          açık elektronik sistemleri veya işletmece sunulan belgeler üzerinden{" "}
          <strong>doğrulamakla yükümlüdür</strong>; doğrulaması tamamlanan
          işletmeye &quot;Doğrulanmış İşletme&quot; işareti verilir ve bu
          bilgilerin güncelliği{" "}
          <strong>her takvim yılında en az bir kez</strong> kontrol edilir
          (ETAHS Yönetmeliği md.6/3). Doğrulamada aykırılık veya eksiklik
          tespit edilen işletmenin profili yayından kaldırılabilir;
          bilgilerini süresinde güncellemeyen işletmeye, güncelleme yapılana
          kadar yalnızca mevcut siparişleri için aracılık hizmeti sunulur.
        </p>
        <p>
          Görünürlük şartlarından biri sonradan eksilirse (örn. profil
          bilgisinin silinmesi) işletme profili otomatik olarak gizlenir.
          Platform kurallarına, bu sözleşmeye veya mevzuata aykırılık hâlinde
          işletme hesabı, aykırılık giderilene kadar askıya alınabilir.
        </p>
        <p>
          <strong>Askıya alma usulü:</strong> Askıya alma veya sonlandırma
          kararından önce aykırılığın gerekçesi işletmeye panel ve e-posta
          yoluyla açıkça bildirilir ve işletmeden açıklama istenir; açıklama
          için işletmeye <strong>en az 3 iş günü</strong> süre verilir. Karar,
          açıklamanın platforma ulaşmasından itibaren en geç{" "}
          <strong>7 iş günü</strong> içinde işletmeye bildirilir (ETAHS
          Yönetmeliği md.17). Askı süresince işletme, yalnızca askıya alma
          tarihinden önce kabul edilmiş mevcut siparişlerine ilişkin iş ve
          işlemleri yürütebilir.
        </p>
        <p>
          Aracılık hizmeti yalnızca; mevzuattan kaynaklanan sebepler, kamu
          düzeninin korunması, gecikmesinde sakınca bulunan hâller ile
          dolandırıcılık, veri ihlali veya diğer siber güvenlik riski şüphesi
          hâllerinde, açıklama süresi beklenmeksizin <strong>derhâl</strong>{" "}
          askıya alınabilir (ETAHS Yönetmeliği md.17/7); bu durumda gerekçe
          işletmeye eş zamanlı olarak bildirilir.
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
            İşletme, kendisine telefonla veya başka bir yolla ulaşan{" "}
            <strong>iptal ve cayma bildirimlerini derhâl</strong> panel
            üzerinden ilgili siparişe işler veya platforma bildirir (Mesafeli
            Sözleşmeler Yönetmeliği md.12/6).
          </li>
          <li>
            İşletme, hizmeti mevzuata uygun, taahhüt ettiği sürede ve özenle
            ifa eder; alım ve teslim anlarını fotoğrafla belgeleyen platform
            akışına uyar.
          </li>
        </ul>

        <h3 className="mt-4 font-semibold text-slate-900">
          Halının Korunması, Sorumluluk ve Tazmin
        </h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            İşletme, halıyı müşteriden fiilen teslim aldığı andan müşteriye geri
            teslim edene kadar geçen tüm süreçte (taşıma, depolama, yıkama,
            kurutma dâhil) halıyı <strong>basiretli bir tacir ve meslek sahibi
            özeniyle korumakla</strong> yükümlüdür. Halının bu süreçte
            kaybolması, çalınması, değer kaybetmesi veya hasar görmesi hâlinde
            işletme, zararın kendi kusuru olmaksızın gerçekleştiğini ispat
            etmedikçe sorumludur; <strong>ispat yükü işletmededir</strong> (6098
            sayılı Kanun md.112, md.471; saklama/emanet hükümleri md.561 vd.
            kıyasen).
          </li>
          <li>
            İşletme; hizmetin ayıplı ifasından, özensiz ifadan ve halının
            korunmasından müşteriye karşı{" "}
            <strong>birinci derecede sorumlu</strong> olduğunu, Platform&apos;un
            aracı sıfatının bu sorumluluğu değiştirmediğini kabul eder (6502
            sayılı Kanun md.13-16). Müşterinin hasar/kayıp/kötü yıkama kaynaklı
            zararını, Kullanım Koşulları&apos;ndaki çözüm süreci uyarınca
            birinci derecede karşılar.
          </li>
          <li>
            <strong>Platform&apos;u tazmin (indemnity):</strong> İşletme;
            profil bilgilerinin yanlışlığı, hizmetin ayıplı ifası, halının hasar
            görmesi/kaybolması veya müşteriye karşı yükümlülüklerini ihlal etmesi
            nedeniyle müşteri veya üçüncü kişilerce Platform&apos;a yöneltilen
            her türlü talep, dava, idari para cezası, tazminat, avukatlık ücreti
            ve yargılama gideri bakımından Platform&apos;u tam olarak tazmin
            etmeyi taahhüt eder. Platform bir ödeme yapmak zorunda kalırsa,
            ödenen tutar için işletmeye <strong>rücu hakkı</strong> saklı olup
            bu tutar işletmenin (online kartlı ödeme aktif olduğunda)
            hakedişinden ya da abonelik alacağından mahsup edilebilir. Bu hüküm
            Platform&apos;un kendi münhasır kusurundan doğan zararları kapsamaz
            (6098 sayılı Kanun md.128).
          </li>
          <li>
            <strong>Teminat:</strong> Platform, müşteri zararlarının
            karşılanmasını güvence altına almak amacıyla gerektiğinde işletmeden
            makul tutarda nakdi teminat, teminat mektubu veya mesleki sorumluluk
            sigortası yaptırmasını talep edebilir; bu talep, işletme aleyhine
            sonuç doğuran değişiklik usulüyle (§9) bildirilir. Sözleşmeye aykırı
            davranış hâlinde işletme, doğan zararın yanı sıra kararlaştırılan
            cezai şartı da öder (6098 sayılı Kanun md.128, md.179-180; kefalet
            için md.581 vd.).
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

      <Section title="7. Dâhilî İletişim Sistemi ve Başvurular">
        <p>
          İşletme, platformla bu sözleşmeye ve aracılık hizmetine ilişkin her
          türlü iletişimini işletme paneli üzerinden{" "}
          <strong>ücretsiz</strong> olarak yürütebilir. Panel üzerinden
          yapılan başvurular <strong>en geç 15 gün içinde</strong>{" "}
          sonuçlandırılır ve sonuç işletmeye panel üzerinden bildirilir (ETAHS
          Yönetmeliği md.18/1).
        </p>
        <p>
          İşbu sözleşmenin işletme tarafından onaylanan sürümü, onay tarihiyle
          birlikte işletme panelinde saklanır; işletme bu metne panel
          üzerinden dilediği zaman kolayca erişebilir (ETAHS Yönetmeliği
          md.15/1-f ve md.18/2).
        </p>
      </Section>

      <Section title="8. Hukuka Aykırı İçerik ve Fikri Mülkiyet Şikâyetleri">
        <p>
          Profil içeriğinin hukuka aykırı olduğundan haberdar olunması
          hâlinde bu içerik, <strong>48 saati geçmemek üzere</strong>{" "}
          gecikmeksizin yayımdan kaldırılır; hukuka aykırı husus, gerekçesiyle
          birlikte işletmeye ve ilgili kamu kurum ve kuruluşlarına bildirilir
          (6563 sayılı Kanun md.9/2; ETAHS Yönetmeliği md.10).
        </p>
        <p>
          Fikri ve sınai mülkiyet hakkı (marka, eser vb.) ihlali şikâyetleri;
          hak sahipliğini gösterir tescil belgesi ve delillerle birlikte{" "}
          <strong>info@enyakinhaliyikamaservisi.com</strong> adresine veya
          panel üzerinden yapılır. Şikâyete konu içerik{" "}
          <strong>48 saati geçmeksizin</strong> yayımdan kaldırılır ve durum
          şikâyet sahibi ile işletmeye bildirilir. İşletmenin belgeye dayalı
          itirazının haklı olduğunun açıkça anlaşılması hâlinde içerik{" "}
          <strong>en geç 24 saat içinde</strong> yeniden yayımlanır (ETAHS
          Yönetmeliği md.12-14 ve md.15/1-ğ). Tarafların adli ve idari
          mercilere başvuru hakları saklıdır.
        </p>
      </Section>

      <Section title="9. Sözleşme Değişiklikleri">
        <p>
          Platform bu sözleşmede ancak haklı sebeplerle değişiklik yapabilir;
          değişiklikler <strong>geçmişe yürümez</strong> (ETAHS Yönetmeliği
          md.11/2-ç). Değişiklikler işletmeye{" "}
          <strong>panel bildirimi ve e-posta yoluyla birlikte</strong>{" "}
          duyurulur; bildirim tarihinden itibaren <strong>15 gün</strong> —
          bedel artışı, hizmetin kısıtlanması, askıya alınması veya
          sonlandırılması, cezai şart getirilmesi gibi işletme aleyhine sonuç
          doğuran değişikliklerde <strong>30 gün</strong> — sonra yürürlüğe
          girer (ETAHS Yönetmeliği md.16).
        </p>
        <p>
          30 günlük bildirim süresine tabi hâllerde işletme, bu süre dolmadan
          panel üzerinden veya e-posta ile bildirimde bulunarak sözleşmeyi{" "}
          <strong>tazminat ödemeksizin feshedebilir</strong>; bildirilen
          sürenin sonunda platformu kullanmaya devam etmek değişikliğin kabulü
          sayılır.
        </p>
      </Section>

      <Section title="10. Fesih ve Fesih Sonrası Veri Erişimi">
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
        <p>
          Üyelik sona erdiğinde işletme; kendi sipariş, işlem ve profil
          verilerine fesih tarihinden itibaren <strong>1 yıl süreyle</strong>{" "}
          panel üzerinden <strong>salt-okunur</strong> olarak erişmeye devam
          eder; bu sürenin sonunda erişim kapatılır (ETAHS Yönetmeliği
          md.15/1-h).
        </p>
      </Section>

      <Section title="11. Kayıtların Delil Niteliği">
        <p>
          Taraflar; platformun veritabanı kayıtlarının, sipariş ve onay
          loglarının, panel işlem kayıtlarının ve sistem tarafından üretilen
          elektronik kayıtların, bu sözleşmeden doğan uyuşmazlıklarda{" "}
          <strong>esas alınacak muteber delil niteliğinde</strong> olduğunu
          kabul eder; aksi her türlü yasal delille ispat edilebilir (6100
          sayılı HMK md.193).
        </p>
      </Section>

      <Section title="12. Uygulanacak Hukuk ve Yetkili Mahkeme">
        <p>
          Bu sözleşme Türkiye Cumhuriyeti hukukuna tabidir. Sözleşmeden doğan
          uyuşmazlıklarda <strong>İstanbul (Çağlayan) Mahkemeleri ve İcra
          Daireleri</strong> yetkilidir. Bu sözleşme işletme ile platform
          arasındaki ticari ilişkiyi düzenler; müşterilerin tüketici
          mevzuatından doğan hakları saklıdır.
        </p>
      </Section>

      <p className="text-sm text-slate-500">Yürürlük: {CONTRACT_VERSION}</p>
    </StaticPage>
  );
}
