import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni",
  description:
    "En Yakın Halı Yıkama platformunda kişisel verilerinizin hangi amaçla işlendiği, kimlerle paylaşıldığı ve haklarınız.",
};

// 6698 sayılı KVKK kapsamında aydınlatma metni (jenerik ama platforma özgü).
export default function KvkkPage() {
  return (
    <StaticPage
      title="KVKK Aydınlatma Metni"
      intro="6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca, platformumuzu kullanırken işlenen kişisel verileriniz hakkında sizi bilgilendirmek isteriz."
    >
      <Section title="1. Veri Sorumlusu">
        <p>
          Kişisel verileriniz, veri sorumlusu sıfatıyla{" "}
          <strong>En Yakın Halı Yıkama</strong> (enyakinhaliyikamaservisi.com)
          tarafından aşağıda açıklanan kapsamda işlenmektedir.
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
          bilgileri işlenir.
        </p>
      </Section>

      <Section title="3. İşleme Amaçları">
        <p>Verileriniz yalnızca şu amaçlarla işlenir:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Sipariş talebinizin oluşturulması ve seçtiğiniz halıcıya iletilmesi</li>
          <li>Halının adresinizden alınması ve teslim edilmesi (operasyon)</li>
          <li>Sipariş durumu hakkında bilgilendirme ve takip bağlantısı gönderimi</li>
          <li>Hizmet kalitesinin izlenmesi ve uyuşmazlıkların çözümü</li>
        </ul>
      </Section>

      <Section title="4. Verilerin Aktarımı">
        <p>
          Bilgileriniz <strong>yalnızca siparişi verdiğiniz halıcı işletme</strong>{" "}
          ve teslimatı yapan şoförü ile paylaşılır. Verileriniz pazarlama amacıyla
          üçüncü kişilere aktarılmaz, satılmaz ve reklam ağlarıyla paylaşılmaz.
        </p>
      </Section>

      <Section title="5. Saklama Süresi">
        <p>
          Sipariş kayıtları, olası uyuşmazlıklar ve yasal yükümlülükler için
          mevzuatta öngörülen süreler boyunca saklanır. Anlık konum verileri gibi
          operasyonel veriler, teslimat tamamlandıktan sonra makul süre içinde
          silinir veya anonimleştirilir.
        </p>
      </Section>

      <Section title="6. Hukuki Sebep">
        <p>
          Verileriniz, KVKK m.5/2-c uyarınca &quot;bir sözleşmenin kurulması veya
          ifasıyla doğrudan doğruya ilgili olması&quot; ve m.5/2-f uyarınca meşru
          menfaat hukuki sebeplerine dayanılarak işlenir.
        </p>
      </Section>

      <Section title="7. Haklarınız ve Başvuru">
        <p>
          KVKK m.11 kapsamında; verilerinize erişme, düzeltilmesini veya
          silinmesini isteme, işlemeye itiraz etme ve zarara uğramanız hâlinde
          giderilmesini talep etme haklarına sahipsiniz.
        </p>
        <p>
          Başvurularınızı{" "}
          <a
            href="mailto:info@enyakinhaliyikamaservisi.com"
            className="font-medium text-brand-dark hover:underline"
          >
            info@enyakinhaliyikamaservisi.com
          </a>{" "}
          adresine iletebilirsiniz. Ayrıca{" "}
          <Link href="/gizlilik" className="font-medium text-brand-dark hover:underline">
            Gizlilik Politikamızı
          </Link>{" "}
          da inceleyebilirsiniz.
        </p>
      </Section>
    </StaticPage>
  );
}
