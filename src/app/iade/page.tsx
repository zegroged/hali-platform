import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "İptal ve İade Koşulları",
  description:
    "En Yakın Halı Yıkama iptal ve iade koşulları: ücretsiz iptal, yıkanmadan iade, kusurlu hizmette çözüm.",
};

export default function IadePage() {
  return (
    <StaticPage
      title="İptal ve İade Koşulları"
      intro="Sipariş oluşturmak ücretsizdir; ödeme hizmet teslim edilirken yapılır. Aşağıdaki koşullar tüm siparişler için geçerlidir."
    >
      <Section title="1. Halı Alınmadan Önce — Ücretsiz İptal">
        <p>
          Halınız adresinizden alınmadan önce siparişinizi hiçbir gerekçe
          göstermeden, ücretsiz iptal edebilirsiniz. İptal için takip
          sayfanızdaki telefon üzerinden işletmeyi arayabilir veya{" "}
          <Link href="/iletisim" className="text-brand-dark underline">
            bize ulaşabilirsiniz
          </Link>
          .
        </p>
      </Section>

      <Section title="2. Halı Alındıktan Sonra, Yıkama Başlamadan — Ücretsiz İade">
        <p>
          Kesin fiyat, halınız işletme tarafından görülüp ölçüldükten sonra
          netleşir. Bildirilen kesin fiyatı kabul etmezseniz halınız{" "}
          <strong>yıkanmadan, ücret talep edilmeden</strong> adresinize iade
          edilir.
        </p>
      </Section>

      <Section title="3. Hizmet Verildikten Sonra — Cayma Hakkı İstisnası">
        <p>
          Halı yıkama, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve
          Mesafeli Sözleşmeler Yönetmeliği kapsamında{" "}
          <strong>ifa edilmiş hizmet</strong> niteliğindedir; yıkama
          tamamlandıktan sonra cayma hakkı kullanılamaz (Yönetmelik md. 15/1-h).
          Bu durum, kusurlu hizmete ilişkin haklarınızı ortadan kaldırmaz.
        </p>
      </Section>

      <Section title="4. Kusurlu Hizmet / Hasar">
        <p>
          Teslim aldığınız halıda yıkamadan kaynaklı bir kusur (leke, hasar,
          renk atması vb.) tespit ederseniz, takip sayfanızdaki telefon
          üzerinden işletmeye veya platforma bildirin. Kusuru fark eder etmez,
          tercihen teslimden itibaren 48 saat içinde bildirmenizi öneririz —
          bu bir <strong>hak düşürücü süre değildir</strong>; 6502 sayılı
          Kanun md. 15-16&apos;daki yasal haklarınız saklıdır. Ayıplı hizmette{" "}
          <strong>seçiminize bağlı olarak</strong>: hizmetin yeniden
          görülmesi, bedel indirimi, ücretsiz onarım/yeniden yıkama veya
          sözleşmeden dönme (bedel iadesi) haklarına sahipsiniz.
        </p>
        <p>
          Platform, çözüm sürecinde müşteri ile işletme arasında aracılık
          eder. Şoförün teslimde çektiği fotoğraflar ve sipariş kayıtları
          süreçte delil olarak kullanılır.
        </p>
      </Section>

      <Section title="5. Kartla Ödemede İade (online ödeme aktif olduğunda)">
        <p>
          Online kartlı ödeme kullanıma açıldığında; iade gereken tutarlar,
          ödemenin yapıldığı karta iyzico ödeme altyapısı üzerinden iade
          edilir. Kart iadelerinin hesabınıza yansıması bankanıza bağlı olarak
          2-10 iş günü sürebilir.
        </p>
      </Section>

      <Section title="6. Başvuru Yolları">
        <p>
          Talepleriniz için önce işletmeyle, çözülemezse platformla iletişime
          geçin. Ayrıca yerleşim yerinizdeki Tüketici Hakem Heyeti&apos;ne veya
          Tüketici Mahkemesi&apos;ne başvurma hakkınız saklıdır.
        </p>
      </Section>

      <Section title="7. Örnek Cayma/İptal Bildirimi">
        <p>
          Cayma veya iptal bildiriminizi dilerseniz aşağıdaki şablonla{" "}
          <strong>info@enyakinhaliyikamaservisi.com</strong> adresine
          e-postayla veya takip sayfanızdaki işletme telefonuna sözlü olarak
          iletebilirsiniz:
        </p>
        <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p>— Alıcı adı-soyadı: ..........</p>
          <p>— Sipariş takip kodu: ..........</p>
          <p>— Tarih: ..........</p>
          <p>
            — Beyan: &quot;.......... takip kodlu halı yıkama siparişimi iptal
            ediyorum / bu siparişe ilişkin cayma hakkımı kullanıyorum.&quot;
          </p>
        </div>
      </Section>
    </StaticPage>
  );
}
