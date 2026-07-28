import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";

// HESAP VE VERİ SİLME SAYFASI (2026-07-28).
//
// Google Play "Veri güvenliği" formu, uygulaması hesap açtıran her geliştiriciden
// HERKESE AÇIK bir "hesap silme" adresi istiyor — uygulamayı kurmadan da
// erişilebilmeli, adımları ve neyin silinip neyin saklandığını açıkça yazmalı.
// Bu sayfa o şart için var; aynı zamanda KVKK md.7 (silme/yok etme) talebinin
// pratik karşılığı.
//
// ⚠️ Play Console → Veri güvenliği → "Hesap silme URL'si" alanına BU adres girilir:
//    https://enyakinhaliyikamaservisi.com/hesap-silme

export const metadata: Metadata = {
  title: "Hesap ve Veri Silme",
  description:
    "En Yakın Halı Yıkama hesabınızı ve verilerinizi nasıl sildireceğiniz: başvuru adımları, silinen ve yasal olarak saklanan veriler.",
  alternates: { canonical: "/hesap-silme" },
};

export default function HesapSilmePage() {
  return (
    <StaticPage
      title="Hesap ve Veri Silme"
      intro="En Yakın Halı Yıkama hesabınızı ve hesabınıza bağlı verileri silinmesini talep edebilirsiniz. Bu sayfa nasıl başvuracağınızı, nelerin silineceğini ve hangi kayıtların yasal zorunlulukla bir süre daha saklandığını anlatır."
    >
      <Section title="Kimler için geçerli">
        <p>
          Bu sayfa hem <strong>web sitesi</strong> hesapları hem de{" "}
          <strong>En Yakın Halı Yıkama</strong> ve{" "}
          <strong>En Yakın Halı Yıkama Şoför</strong> mobil uygulamalarındaki
          hesaplar için geçerlidir. Müşteri, işletme sahibi ve şoför hesaplarının
          tamamını kapsar.
        </p>
      </Section>

      <Section title="Nasıl başvurulur">
        <p>Silme talebiniz için aşağıdaki adımları izleyin:</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            <strong>destek@enyakinhaliyikamaservisim.com</strong> adresine
            e-posta gönderin.
          </li>
          <li>
            Konu satırına <strong>&quot;Hesap silme talebi&quot;</strong> yazın.
          </li>
          <li>
            E-postanın içine hesabınızda kayıtlı{" "}
            <strong>kullanıcı adınızı veya telefon numaranızı</strong> ekleyin.
            (Talebi hesap sahibinin gönderdiğini doğrulamak için gereklidir —
            başkasının hesabını sildirmeyi engeller.)
          </li>
          <li>
            Talebinizi aldığımızı <strong>3 iş günü</strong> içinde teyit eder,
            en geç <strong>30 gün</strong> içinde silme işlemini tamamlarız.
          </li>
        </ol>
        <p className="mt-3">
          Talebinizi{" "}
          <Link href="/iletisim" className="font-medium text-brand-dark underline">
            iletişim sayfasındaki
          </Link>{" "}
          kanallardan da iletebilirsiniz.
        </p>
      </Section>

      <Section title="Silinen veriler">
        <p>Talebiniz üzerine aşağıdaki veriler kalıcı olarak silinir:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Ad, soyad, telefon numarası, e-posta adresi, kullanıcı adı</li>
          <li>Adres bilgileri ve sipariş sırasında paylaşılan konum verisi</li>
          <li>Şoför hesaplarında: kaydedilmiş konum geçmişi ve durak kayıtları</li>
          <li>Uygulama içi bildirimler ve oturum kayıtları</li>
          <li>Yazdığınız değerlendirme ve yorumlar</li>
          <li>İşletme hesaplarında: işletme profili, fotoğraflar, fiyat listesi</li>
        </ul>
      </Section>

      <Section title="Yasal zorunlulukla saklanan kayıtlar">
        <p>
          Bazı kayıtlar, siz talep etseniz bile mevzuat gereği belirli bir süre
          saklanmak zorundadır. Bu kayıtlar <strong>kimliğinizden arındırılır</strong>{" "}
          (adınız, telefonunuz ve adresiniz çıkarılır), yalnız yasal olarak
          tutulması gereken kısım kalır:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Fatura ve ödeme kayıtları</strong> — Vergi Usul Kanunu
            uyarınca 5 yıl
          </li>
          <li>
            <strong>Sipariş ve sözleşme kayıtları</strong> — Mesafeli
            Sözleşmeler Yönetmeliği kapsamında 3 yıl
          </li>
          <li>
            <strong>Alım/teslim fotoğrafları</strong> — devam eden bir
            uyuşmazlık varsa çözülene kadar
          </li>
        </ul>
        <p className="mt-3">
          Bu süreler dolduğunda ilgili kayıtlar da otomatik olarak silinir.
        </p>
      </Section>

      <Section title="Hesabı silmeden yalnız belirli verileri sildirme">
        <p>
          Hesabınızı kapatmak zorunda değilsiniz.{" "}
          <strong>
            Verilerinizin yalnız bir kısmının silinmesini de talep edebilirsiniz
          </strong>{" "}
          — hesabınız açık kalır, çalışmaya devam eder.
        </p>
        <p className="mt-2">Örneğin şunları ayrı ayrı sildirebilirsiniz:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Kayıtlı adresleriniz ve geçmiş sipariş konumlarınız</li>
          <li>Şoför hesaplarında: geçmiş konum ve durak kayıtları</li>
          <li>Yazdığınız değerlendirme ve yorumlar</li>
          <li>E-posta adresiniz veya ikinci telefon numaranız</li>
        </ul>
        <p className="mt-3">
          Başvuru yolu hesap silmeyle aynıdır:{" "}
          <strong>destek@enyakinhaliyikamaservisim.com</strong> adresine, konu
          satırına <strong>&quot;Veri silme talebi&quot;</strong> yazıp hangi
          verilerin silinmesini istediğinizi belirtin. Aynı adresten hangi
          verilerinizin tutulduğunu öğrenebilir, yanlış bilgilerin
          düzeltilmesini de isteyebilirsiniz.
        </p>
        <p className="mt-3">
          KVKK md.11 kapsamındaki haklarınızın tamamı ve başvuru usulü için{" "}
          <Link href="/kvkk" className="font-medium text-brand-dark underline">
            KVKK Aydınlatma Metni
          </Link>{" "}
          sayfasına bakabilirsiniz.
        </p>
      </Section>
    </StaticPage>
  );
}
