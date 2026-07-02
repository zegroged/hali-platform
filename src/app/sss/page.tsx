import type { Metadata } from "next";
import Link from "next/link";
import StaticPage from "../_static/StaticPage";

export const metadata: Metadata = {
  title: "Sık Sorulan Sorular",
  description:
    "Fiyat nasıl netleşir, ödeme ne zaman yapılır, halım kaç günde gelir? Kapıdan halı yıkama hakkında merak edilenler.",
};

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Fiyat nasıl netleşir?",
    a: (
      <>
        Profillerdeki fiyatlar m² başına tahmini fiyatlardır. Halınız kapınızdan
        alınıp ölçüldükten sonra kesin fiyat size bildirilir. Fiyatı uygun
        bulmazsanız halınız yıkanmadan ücretsiz geri getirilir.
      </>
    ),
  },
  {
    q: "Ödemeyi ne zaman ve nasıl yapıyorum?",
    a: (
      <>
        Ödeme <strong>teslimatta</strong> yapılır — sipariş oluştururken hiçbir
        ön ödeme veya kapora alınmaz. Halınız temiz şekilde kapınıza
        geldiğinde ücretini doğrudan halıcıya ödersiniz.
      </>
    ),
  },
  {
    q: "Halım kaybolursa veya zarar görürse ne olur?",
    a: (
      <>
        Her sipariş kayıt altındadır: hangi işletmenin ne zaman aldığı ve
        teslim ettiği adım adım izlenir. Hasar veya kayıp durumunda hizmeti
        veren işletme sorumludur; çözüm sürecinde platform olarak aracılık
        ederiz. Böyle bir durumda <Link href="/iletisim" className="font-medium text-brand-dark hover:underline">bize ulaşın</Link>.
      </>
    ),
  },
  {
    q: "Halım kaç günde teslim edilir?",
    a: (
      <>
        Teslim süresi işletmeye ve yoğunluğa göre değişir; her halıcının
        profilinde tahmini teslim süresi (örn. 2-4 iş günü) yazar. Süre,
        halınız alındığında netleştirilir.
      </>
    ),
  },
  {
    q: "Siparişimi nasıl takip ederim?",
    a: (
      <>
        Sipariş oluşturduğunuzda size özel bir takip bağlantısı ve kod verilir.
        <Link href="/takip" className="font-medium text-brand-dark hover:underline"> Takip sayfasına</Link>{" "}
        kodunuzu girerek halınızın hangi aşamada olduğunu (alındı, yıkanıyor,
        yolda...) anlık görebilirsiniz.
      </>
    ),
  },
  {
    q: "Hangi bölgelerde hizmet var?",
    a: (
      <>
        Platform yenidir ve bölge bölge açılıyoruz. Ana sayfada adresinizi
        aratarak veya konumunuzu kullanarak bölgenizde hizmet veren halıcıları
        görebilirsiniz; listede işletme yoksa bölgenizde henüz açılmamışız
        demektir.
      </>
    ),
  },
  {
    q: "Halıcıyım — platforma nasıl katılırım?",
    a: (
      <>
        Kayıt ücretsizdir. <Link href="/giris" className="font-medium text-brand-dark hover:underline">İşletme girişi</Link>{" "}
        sayfasından başvurabilir veya{" "}
        <Link href="/iletisim" className="font-medium text-brand-dark hover:underline">iletişim</Link>{" "}
        kanallarından bize yazabilirsiniz. İşletmeniz doğrulandıktan sonra
        profiliniz listelenmeye başlar.
      </>
    ),
  },
  {
    q: "Siparişim iptal edilir veya reddedilirse ne olur?",
    a: (
      <>
        Halınız alınmadan önce siparişinizi ücretsiz iptal edebilirsiniz.
        İşletme yoğunluk veya kapsama alanı nedeniyle talebi reddederse takip
        sayfanızda görürsünüz ve dilediğiniz başka bir halıcıdan yeniden talep
        oluşturabilirsiniz. Ödeme teslimde olduğu için iade süreci gerekmez.
      </>
    ),
  },
];

export default function SssPage() {
  return (
    <StaticPage
      title="Sık Sorulan Sorular"
      intro="Kapıdan halı yıkama hizmeti hakkında en çok merak edilenler. Cevabını bulamadığınız sorular için iletişim sayfamızı kullanın."
    >
      <div className="space-y-3">
        {FAQS.map((f, i) => (
          <details
            key={i}
            className="group rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
              {f.q}
              <span
                aria-hidden
                className="shrink-0 text-slate-500 transition-transform group-open:rotate-90"
              >
                ›
              </span>
            </summary>
            <p className="border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-600">
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </StaticPage>
  );
}
