import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description:
    "En Yakın Halı Yıkama nedir, nasıl çalışır? Aracı pazar yeri modelimiz, işletme doğrulama sürecimiz ve güven ilkelerimiz.",
};

export default function HakkimizdaPage() {
  return (
    <StaticPage
      title="Hakkımızda"
      intro="En Yakın Halı Yıkama, müşterileri yakınlarındaki halı yıkama işletmeleriyle buluşturan bir aracı pazar yeri platformudur."
    >
      <Section title="Platform Nedir?">
        <p>
          enyakinhaliyikamaservisi.com, halı yıkama hizmetinin kendisini vermez;
          bağımsız halı yıkama işletmelerini listeleyen ve sipariş talebinizi
          seçtiğiniz işletmeye ileten bir{" "}
          <strong>aracı hizmet sağlayıcıdır</strong> (6563 sayılı Elektronik
          Ticaretin Düzenlenmesi Hakkında Kanun md.2/1-d anlamında). Halınızın
          alınması, yıkanması ve teslimi, profilinden sipariş verdiğiniz
          işletme tarafından gerçekleştirilir.
        </p>
      </Section>

      <Section title="Nasıl Çalışır?">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <strong>Halıcını seç:</strong> Konumuna göre yakınındaki
            doğrulanmış işletmeleri fiyatları ve puanlarıyla karşılaştır.
          </li>
          <li>
            <strong>Talebini oluştur:</strong> Adres ve halı bilgilerini gir;
            işletme halını kapından alsın. Ön ödeme yok — ödeme teslimde.
          </li>
          <li>
            <strong>Adım adım takip et:</strong> Alımdan teslimata kadar her
            aşamayı takip sayfandan izle; teslimde fotoğraflı kanıt gör.
          </li>
        </ol>
      </Section>

      <Section title="İşletme Doğrulama Yaklaşımımız">
        <p>
          Platformda listelenmek isteyen her işletme; vergi kimlik bilgisi ve
          belge beyanı, e-posta doğrulaması ve eksiksiz profil (fiyat, hizmet
          {/* KODLA ÇELİŞİYORDU (2026-07-29): "yalnızca yönetici onayından
              geçen işletmeler görünür" deniyordu, oysa yayın 2026-07-08'den
              beri OTOMATİK — yönetici onayı yalnız "Doğrulanmış" rozeti verir.
              Yapılmayan bir denetimi müşteriye taahhüt etmek, hasar hâlinde
              doğrudan sorumluluk doğurur. */}
          bölgesi, iletişim) adımlarını tamamlar. Bu adımlar tamamlandığında
          işletme <strong>otomatik olarak</strong> yayına girer. Belgelerini
          ayrıca sunan ve incelemeden geçen işletmeler{" "}
          <strong>Doğrulanmış İşletme</strong> rozeti alır — rozet yayının
          şartı değil, ek bir güven işaretidir. Bilgileri eksilen veya
          kurallara aykırı davranan işletmeler yayından kaldırılabilir.
        </p>
      </Section>

      <Section title="Neden Güvenebilirsin?">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Şeffaf takip:</strong> Siparişin her adımı (alım, yıkama,
            teslimat) takip sayfasında anlık görünür.
          </li>
          <li>
            <strong>Fotoğraflı teslim kanıtı:</strong> Halının alım ve teslim
            anları fotoğrafla kayıt altına alınır.
          </li>
          <li>
            <strong>Doğrulanmış işletme rozeti:</strong> Yalnızca belge ve
            profil incelemesinden geçen işletmeler &quot;doğrulanmış&quot;
            rozetiyle listelenir.
          </li>
          <li>
            <strong>Ön ödeme yok:</strong> Ödemeni halın teslim edildiğinde
            yaparsın; kesin fiyatı beğenmezsen halın yıkanmadan ücretsiz iade
            edilir.
          </li>
        </ul>
      </Section>

      <Section title="Künye ve İletişim">
        <p>
          İşletici: <strong>[YASAL AD]</strong> (şahıs işletmesi) ·
          [ADRES], Selçuklu/Konya ·
          Vergi Dairesi/No: Meram / [VKN]. Bize ulaşmak için{" "}
          <Link
            href="/iletisim"
            className="font-medium text-brand-dark hover:underline"
          >
            iletişim sayfamızı
          </Link>{" "}
          kullanabilirsiniz.
        </p>
      </Section>
    </StaticPage>
  );
}
