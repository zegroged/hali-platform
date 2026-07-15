import type { Metadata } from "next";
import Link from "next/link";
import StaticPage, { Section } from "../_static/StaticPage";
import { CONTRACT_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "İptal ve İade Koşulları",
  description:
    "En Yakın Halı Yıkama iptal ve iade koşulları: ücretsiz iptal, yıkanmadan iade, kusurlu hizmette çözüm.",
};

// TODO(iyzico): Ödeme kuruluşu sözleşmesi imzalanınca §5'teki "anlaşmalı
// ödeme kuruluşu" ifadesi marka adıyla (iyzico) güncellenecek.
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
          sayfanızdaki <strong>&quot;Siparişi iptal et&quot;</strong> butonunu
          kullanabilir, işletmeyi telefonla arayabilir veya{" "}
          <Link href="/iletisim" className="text-brand-dark underline">
            bize ulaşabilirsiniz
          </Link>
          . Halınız teslim alındıktan sonra hizmet ifası başladığından bu buton
          kapanır; kesin fiyatı onaylamazsanız halınız yıkanmadan ücretsiz iade
          edilir (bkz. madde 2).
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

      <Section title="4. Kusurlu (Ayıplı) Hizmet / Hasar">
        <p>
          Teslim aldığınız halıda yıkamadan veya taşımadan kaynaklı bir kusur ya
          da hasar (leke, hasar, renk atması, çekme/boyut değişimi, yırtılma,
          kayıp vb.) tespit ederseniz, takip sayfanızdan veya{" "}
          <strong>info@enyakinhaliyikamaservisi.com</strong> adresinden bildirin.
          Kusuru fark eder etmez bildirmenizi öneririz; bu bir{" "}
          <strong>hak düşürücü süre değildir</strong> — ayıplı hizmete ilişkin
          yasal haklarınız hizmetin ifasından itibaren <strong>iki yıl</strong>{" "}
          (ağır kusur/hile ile gizlenmiş ayıpta süresiz) saklıdır (6502 sayılı
          Kanun md.16).
        </p>
        <p>
          Ayıplı hizmette <strong>seçiminize bağlı olarak</strong>: (a) halının
          ücretsiz yeniden yıkanması, (b) ayıp oranında bedel indirimi, (c)
          eserin ücretsiz onarımı veya (d) sözleşmeden dönerek bedel iadesi
          haklarına sahipsiniz; yeniden yıkama/onarım en geç{" "}
          <strong>30 iş günü</strong> içinde ve masrafı işletmeye ait olacak
          şekilde yapılır (6502 sayılı Kanun md.15). Halının hasar görmesi veya
          kaybolması hâlinde halının <strong>rayiç değeri</strong> üzerinden
          ayrıca tazminat isteme hakkınız saklıdır (6098 sayılı Kanun md.112).
        </p>
        <p>
          <strong>Çözüm akışı:</strong> Platform başvurunuzu gecikmeksizin
          işletmeye iletir; halının alım (öncesi) ve teslim (sonrası)
          fotoğrafları ile sipariş kayıtları esas alınır; işletme en geç{" "}
          <strong>5 iş günü</strong> içinde çözüm sunar; uzlaşılamazsa Platform
          en geç <strong>15 gün</strong> içinde değerlendirip sonucu bildirir.
          Yerleşim yerinizdeki Tüketici Hakem Heyeti&apos;ne, Tüketici
          Mahkemesi&apos;ne ve dava şartı arabuluculuğa başvurma hakkınız her
          zaman saklıdır.
        </p>
      </Section>

      <Section title="5. Kartla Ödemede İade (online ödeme aktif olduğunda)">
        <p>
          Online kartlı ödeme kullanıma açıldığında; iade gereken tutar,
          cayma/iptal bildiriminin ulaşmasından itibaren en geç{" "}
          <strong>14 gün içinde</strong>, ödemeyi yaptığınız karta anlaşmalı
          ödeme kuruluşu aracılığıyla <strong>tek seferde</strong> iade
          edilmek üzere başlatılır (Mesafeli Sözleşmeler Yönetmeliği md.
          12/3-4). Kart iadelerinin hesabınıza yansıması bankanıza bağlı
          olarak 2-10 iş günü sürebilir.
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

      <p className="text-sm text-slate-500">Yürürlük: {CONTRACT_VERSION}</p>
    </StaticPage>
  );
}
