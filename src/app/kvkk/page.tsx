import type { Metadata } from "next";
import Link from "next/link";
import { CONTRACT_VERSION } from "@/lib/legal";
import StaticPage, { Section } from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni",
  description:
    "En Yakın Halı Yıkama platformunda kişisel verilerinizin hangi amaçla işlendiği, kimlerle paylaşıldığı ve haklarınız.",
};

// 6698 sayılı KVKK md.10 ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde
// Uyulacak Usul ve Esaslar Hakkında Tebliğ'e (RG 10.03.2018/30356) uygun
// aydınlatma metni: veri sorumlusu kimliği, işleme amaçları, aktarım,
// toplama yöntemi + hukuki sebep ve md.11 haklarının tam listesi.
export default function KvkkPage() {
  return (
    <StaticPage
      title="KVKK Aydınlatma Metni"
      intro="6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) md.10 uyarınca, platformumuzu kullanırken işlenen kişisel verileriniz hakkında sizi bilgilendirmek isteriz."
    >
      <Section title="1. Veri Sorumlusu">
        <p>
          Kişisel verileriniz, veri sorumlusu sıfatıyla{" "}
          <strong>En Yakın Halı Yıkama</strong> (enyakinhaliyikamaservisi.com)
          tarafından aşağıda açıklanan kapsamda işlenmektedir.
        </p>
        {/* TODO(künye): tescil tamamlanınca ticari unvan + adres buraya işlenecek. */}
        <p>
          Veri sorumlusunun ticari unvanı ve adres bilgisi, işletme tescil
          işlemleri tamamlandığında bu bölümde yayımlanacaktır. KVKK
          kapsamındaki başvurularınız için başvuru kanalı:{" "}
          <a
            href="mailto:info@enyakinhaliyikamaservisi.com"
            className="font-medium text-brand-dark hover:underline"
          >
            info@enyakinhaliyikamaservisi.com
          </a>
        </p>
      </Section>

      <Section title="2. Toplanan Kişisel Veriler">
        <p>Sipariş oluştururken yalnızca operasyon için gereken veriler alınır:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Ad ve soyad</li>
          <li>Telefon numarası</li>
          <li>Alım/teslimat adresi</li>
          <li>İsteğe bağlı olarak paylaştığınız konum bilgisi</li>
          <li>Sipariş notu ve yaklaşık halı ölçüsü gibi sipariş detayları</li>
        </ul>
        <p>
          İşletme (halıcı) hesapları için ayrıca e-posta adresi ve işletme
          bilgileri; şoför hesapları için ad, telefon ve teslimat sırasında
          anlık konum bilgisi (bkz. bölüm 6) işlenir.
        </p>
      </Section>

      <Section title="3. İşleme Amaçları">
        <p>Verileriniz yalnızca şu amaçlarla işlenir:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Sipariş talebinizin oluşturulması ve seçtiğiniz halıcıya iletilmesi</li>
          <li>Halının adresinizden alınması ve teslim edilmesi (operasyon)</li>
          <li>Sipariş durumu hakkında bilgilendirme ve takip bağlantısı gönderimi</li>
          <li>Hizmet kalitesinin izlenmesi ve uyuşmazlıkların çözümü</li>
          <li>Platformun güvenliğinin sağlanması ve hukuki yükümlülüklerin yerine getirilmesi</li>
        </ul>
      </Section>

      <Section title="4. Toplama Yöntemi ve Hukuki Sebep">
        <p>
          Kişisel verileriniz şu kanallardan, elektronik ortamda ve kısmen
          otomatik yollarla toplanır:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Sitedeki web formları (sipariş talebi formu ve işletme kayıt formu)
            üzerinden doğrudan sizin ilettiğiniz bilgiler
          </li>
          <li>
            İsteğe bağlı olarak izin vermeniz hâlinde tarayıcınızın konum izni
            üzerinden alınan konum bilgisi
          </li>
          <li>
            Hizmetin sunulması sırasında otomatik olarak oluşan sunucu erişim
            kayıtları (log)
          </li>
        </ul>
        <p>
          Bu işlemenin dayandığı hukuki sebepler (KVKK md.5) şunlardır:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>KVKK md.5/2-c:</strong> bir sözleşmenin kurulması veya
            ifasıyla doğrudan doğruya ilgili olması (sipariş ve teslimat
            sürecinin yürütülmesi)
          </li>
          <li>
            <strong>KVKK md.5/2-ç:</strong> veri sorumlusunun hukuki
            yükümlülüğünü yerine getirebilmesi için zorunlu olması (yasal
            saklama ve bildirim yükümlülükleri)
          </li>
          <li>
            <strong>KVKK md.5/2-f:</strong> temel hak ve özgürlüklerinize zarar
            vermemek kaydıyla meşru menfaat (platform güvenliğinin sağlanması,
            erişim kayıtlarının tutulması)
          </li>
        </ul>
      </Section>

      <Section title="5. Verilerin Aktarımı">
        <p>
          Sipariş bilgileriniz, hizmetin ifası amacıyla{" "}
          <strong>siparişi verdiğiniz halıcı işletme</strong> ve teslimatı yapan{" "}
          <strong>şoförü</strong> ile paylaşılır. Ayrıca hizmetin teknik olarak
          sunulabilmesi için aşağıdaki kategorilerdeki hizmet sağlayıcılara
          aktarım yapılabilir:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>SMS gönderim sağlayıcısı</strong> (sipariş bilgilendirme ve
            takip bağlantısının iletilmesi için telefon numaranız)
          </li>
          <li>
            <strong>Harita / coğrafi kodlama sağlayıcısı</strong> (adresin
            haritada gösterilmesi ve konumlandırılması için adres/ilçe bilgisi)
          </li>
          <li>
            <strong>Barındırma ve güvenlik (CDN) sağlayıcısı</strong> (sitenin
            güvenli şekilde sunulması sırasında işlenen trafik verileri)
          </li>
          <li>
            <strong>Ödeme kuruluşu (iyzico)</strong> — yalnızca online ödeme
            aktif olduğunda, ödemenin gerçekleştirilmesi için gereken bilgiler
          </li>
        </ul>
        <p>
          Yalnızca hizmetin gerektirdiği asgari veri, ilgili sağlayıcıya
          aktarılır. Verileriniz pazarlama amacıyla üçüncü kişilere aktarılmaz,
          satılmaz ve reklam ağlarıyla paylaşılmaz.
        </p>
        {/* KVKK md.9 + md.10/1-c ve Aydınlatma Tebliği md.5/1-ı: yurt dışına
            aktarım ihtimali olan alıcı grupları açıkça belirtilir. */}
        <p>
          <strong>Yurt Dışına Aktarım:</strong> Harita ve coğrafi kodlama
          hizmeti yurt dışında yerleşik sağlayıcılardan alınır: konum araması
          yaptığınızda girdiğiniz arama metni{" "}
          <strong>OpenStreetMap Nominatim</strong> servisine iletilebilir;
          harita görüntülenirken tarayıcınız yurt dışındaki{" "}
          <strong>CARTO</strong> karo sunucusuna bağlanır ve bu sırada IP
          adresiniz bu sunucuya iletilir. Barındırma ve güvenlik (CDN)
          sağlayıcımız da yurt dışında yerleşik olabilir. SMS gönderimi ise
          Türkiye&apos;de yerleşik sağlayıcı üzerinden yapılır. Yurt dışına
          yapılan aktarımlar bakımından KVKK md.9 kapsamındaki güvence
          (standart sözleşme vb.) çalışmaları sürdürülmektedir.
        </p>
      </Section>

      <Section title="6. Şoför ve İşletme Çalışanı Verileri">
        <p>
          Teslimatı yürüten şoförlere ait <strong>ad, telefon numarası ve
          mesai sırasında anlık konum</strong> bilgisi işlenir. Bu işlemenin
          amaçları; teslimatın yürütülmesi, operasyon güvenliğinin sağlanması
          ve müşteriye süreç şeffaflığı sunulmasıdır.
        </p>
        <p>
          Şoförün adı ve canlı konumu, <strong>yalnızca teslimata çıkılan
          siparişin müşterisine</strong> gösterilir; başka kullanıcılarla veya
          üçüncü kişilerle paylaşılmaz. Şoför hesaplarını platformda işletmeler
          açtığından, işletmeler çalıştırdıkları şoförleri bu işleme hakkında
          bilgilendirmekle yükümlüdür.
        </p>
        {/* KVKK md.4/2-d (ölçülülük) ve md.5/2-f denge testi: izlemenin
            mesaiyle sınırlı olduğu ve durak kayıtlarının saklama süresi. */}
        <p>
          Konum izleme <strong>yalnızca şoförün mesaisi açıkken</strong>{" "}
          yapılır; mesai kapatıldığında izleme durur. Teslimat duraklarına
          ilişkin özet kayıtlar, operasyon raporlaması için <strong>12 ay</strong>{" "}
          saklanır; bu sürenin sonunda silinir veya anonimleştirilir.
        </p>
      </Section>

      <Section title="7. Saklama Süresi">
        <p>
          Sipariş kayıtları, olası uyuşmazlıklar ve yasal yükümlülükler için
          mevzuatta öngörülen süreler boyunca saklanır. Sipariş ve işlem
          kayıtları, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında
          Kanun md.11/3 uyarınca <strong>10 yıl</strong> süreyle saklanır.
          Anlık konum verileri gibi operasyonel veriler, teslimat
          tamamlandıktan sonra makul süre içinde silinir veya anonimleştirilir.
        </p>
        <p>
          Olası bir veri ihlalinde, KVKK md.12/5 uyarınca ilgili kişiler ve
          Kişisel Verileri Koruma Kurulu mevzuattaki süreler içinde
          bilgilendirilir.
        </p>
      </Section>

      <Section title="8. Haklarınız (KVKK md.11)">
        <p>
          KVKK md.11 uyarınca veri sorumlusuna başvurarak kendinizle ilgili
          şu haklara sahipsiniz:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme</li>
          <li>
            İşlenme amacını ve verilerin amacına uygun kullanılıp
            kullanılmadığını öğrenme
          </li>
          <li>
            Yurt içinde veya yurt dışında verilerin aktarıldığı üçüncü kişileri
            bilme
          </li>
          <li>
            Verilerin eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini
            isteme
          </li>
          <li>
            KVKK md.7&apos;deki şartlar çerçevesinde verilerin silinmesini veya
            yok edilmesini isteme
          </li>
          <li>
            Düzeltme, silme ve yok etme işlemlerinin, verilerin aktarıldığı
            üçüncü kişilere bildirilmesini isteme
          </li>
          <li>
            İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz
            edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz
            etme
          </li>
          <li>
            Verilerin kanuna aykırı işlenmesi sebebiyle zarara uğramanız
            hâlinde zararın giderilmesini talep etme
          </li>
        </ul>
      </Section>

      <Section title="9. Başvuru Usulü">
        <p>
          Yukarıdaki haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna
          Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca{" "}
          <strong>yazılı olarak</strong> veya{" "}
          <a
            href="mailto:info@enyakinhaliyikamaservisi.com"
            className="font-medium text-brand-dark hover:underline"
          >
            info@enyakinhaliyikamaservisi.com
          </a>{" "}
          adresine <strong>e-posta</strong> ile iletebilirsiniz. Başvurunuz,
          talebin niteliğine göre en kısa sürede ve en geç{" "}
          <strong>30 gün içinde</strong> ücretsiz olarak sonuçlandırılır.
          Ayrıca{" "}
          <Link href="/gizlilik" className="font-medium text-brand-dark hover:underline">
            Gizlilik Politikamızı
          </Link>{" "}
          da inceleyebilirsiniz.
        </p>
        {/* Veri Sorumlusuna Başvuru Tebliği md.5/2: başvuruda bulunması
            zorunlu asgari içerik. */}
        <p>
          Başvurunuzda ad-soyad, (yazılı başvuruda) imza, T.C. kimlik /
          pasaport numarası, tebligata esas adres, varsa bildirime esas
          e-posta/telefon ve talep konusunun bulunması zorunludur (Veri
          Sorumlusuna Başvuru Tebliği md.5/2).
        </p>
      </Section>

      {/* Aydınlatma Tebliği md.5/1-e: hangi sürümün yürürlükte olduğunun
          ispatı — sürüm no, sipariş kaydındaki contractVersion ile eşleşir. */}
      <p className="text-sm text-slate-500">
        Yürürlük tarihi: 02.07.2026 · Sürüm: {CONTRACT_VERSION}
      </p>
    </StaticPage>
  );
}
