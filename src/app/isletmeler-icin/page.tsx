import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
import PlanCard from "@/components/PlanCard";
import {
  IconWallet,
  IconTruck,
  IconStar,
  IconShield,
  IconBolt,
  IconPackage,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İşletmeler İçin — Halı Yıkama İşletme Yönetim Paneli",
  description:
    "Halı yıkama işletmeni tek panelden yönet: şoförünü haritada izle, alım-teslim fotoğrafını kayda al, kesin fiyatı yazılı onaylat, kâr-zararını gör. Ayrıca bölgenin sayfasında listelenirsin. Sabit aylık abonelik, sipariş başına komisyon yok.",
  alternates: { canonical: "/isletmeler-icin" },
};

/** Bekleyen müşteri bölümü bu toplamın altındaysa hiç gösterilmez. */
const TALEP_ESIGI = 10;
/** Şehir rozeti bu sayının altındaki şehirler için basılmaz. */
const SEHIR_ESIGI = 3;

// SIRALAMA KASITLIDIR (2026-07-29). Eskiden liste "komisyon yok" ve "973 ilçede
// görünürlük" ile açılıyordu — yani halıcıya ödediği paranın karşılığı olarak
// MÜŞTERİ vaat ediliyordu. Canlıda tüm zamanlarda 3 teslim edilmiş sipariş ve
// 0 yorum var; o vaat tutulmuyor ve 2. ay yenilememenin sebebi bu. Artık önce
// GERÇEKTEN çalışan yazılım anlatılıyor, keşif/görünürlük listenin altında ve
// taahhütsüz duruyor. Bu listeye bir madde eklerken tek ölçüt: kodda çalışıyor mu?
const PERKS = [
  {
    icon: <IconPackage size={20} />,
    title: "Sipariş yönetim paneli",
    desc: "Gelen siparişi onayla, halıyı ölçüp kesin fiyatı bildir, adım adım ilerlet. Dükkâna gelen müşterin için de takip kodlu kayıt açarsın — siteden hiç sipariş gelmese bile panel çalışır.",
  },
  {
    icon: <IconTruck size={20} />,
    title: "Şoförünü haritadan izle",
    desc: "Mesai açıkken şoförünü canlı görürsün: nerede, ne zaman durmuş, ne kadar kalmış. Geçmiş bir günün rotasını baştan oynatır, ay sonunda şoför şoför durak raporu alırsın. Kesintisiz akış için şoförün Android uygulamasını kullanması gerekir; tarayıcıdan girildiğinde telefon kilitlenince konum akışı durur.",
  },
  {
    icon: <IconShield size={20} />,
    title: "Alım ve teslim fotoğrafla kayıtta",
    desc: "Şoför uygulamasında teslim fotoğrafı çekilmeden sipariş teslim edilmiş sayılmaz — kural sunucuda uygulanır. Panelden fotoğrafsız ilerletirsen siparişin geçmişine bu da not düşer. Bu kayıtlar tartışmada delildir; sigorta değildir.",
  },
  {
    icon: <IconWallet size={20} />,
    title: "KASA — kâr mı ettin, zarar mı",
    desc: "Maaş, deterjan, yakıt, kira gibi tekrarlayan giderleri bir kez tanımla, her ay kendiliğinden düşsün. Teslim ettiğin siparişlerin geliri deftere otomatik işlenir. Resmî muhasebe defteri değildir, kâr-zararını görmen içindir.",
  },
  {
    icon: <IconStar size={20} />,
    title: "Kesin fiyat, yazılı onay",
    desc: "Halıyı ölçtükten sonra kesin fiyatı panelden bildirirsin; müşteri kendi telefonundan onaylar ve onay zaman damgasıyla kayda geçer. Onaydan sonra bildirilen fiyat kilitlenir; teslimde farklı bir tutar tahsil edilirse bu da siparişin geçmişine yazılır.",
  },
  {
    icon: <IconWallet size={20} />,
    title: "Sipariş başına komisyon yok",
    desc: "Müşteriden aldığın ücretin tamamı senin. Platform sabit aylık abonelikle çalışır — ciron büyüdükçe kesinti artmaz.",
  },
  {
    icon: <IconBolt size={20} />,
    title: "Bölgenin sayfasında listelenirsin",
    desc: "Halıcısı olan il ve ilçelerin sayfaları arama motorlarına açıktır; sen girdiğinde bölgenin sayfası da açılır. Müşteri seni fotoğrafların ve fiyat listenle görür, buradan sipariş verirse panelinde çıkar. Kaç müşteri geleceğine dair söz vermiyoruz — sistem yeni, buradan gelen sipariş sayısı bugün az.",
  },
  {
    icon: <IconStar size={20} />,
    title: "Yorum ve puanla itibar",
    desc: "Teslim edilen sipariş için müşteri yıldız ve yorum bırakabilir; yorum yazmak hesap açmayı gerektirir. Google profilin de sayfana bağlanır.",
  },
  {
    icon: <IconShield size={20} />,
    title: "Doğrulanmış İşletme rozeti",
    desc: "Belgelerini sunan işletme rozet alır, müşteri karşısında öne çıkar. Sözleşme ve mevzuat uyumu platformda hazır.",
  },
];

const FAQS = [
  {
    q: "Komisyon ödüyor muyum?",
    a: "Hayır. Sipariş başına komisyon veya ciro kesintisi yok; yalnız sabit aylık abonelik ödersin. Müşteriden tahsilatı doğrudan sen yaparsın (teslimde).",
  },
  {
    q: "Ne zaman yayına girerim?",
    a: "Kayıt + ödeme sonrası profilini doldurduğun an (fiyat listesi, hizmet bölgeleri, fotoğraf, en az 1 şoför) otomatik yayına girersin — genellikle aynı gün.",
  },
  {
    q: "Şoför şart mı?",
    a: "Evet, en az 1 şoför gerekir; kapıdan alma modeli şoförle çalışır. Şoförünü panelden 2 dakikada eklersin — kendi telefonunun tarayıcısından işlerini görür, fotoğraf çeker, teslim eder. Ayrı bir program kurmasına gerek yok; Android uygulaması da yayına hazırlanıyor.",
  },
  {
    q: "Aidatı hangi kartla ödeyebilirim?",
    a: "İki yol da açık. Kredi kartın varsa düzenli ödeme talimatı verirsin, her ay kendiliğinden yenilenir. Banka (debit) kartın varsa talimat verilemiyor — bankalar banka kartında 3D Secure şart koşuyor, abonelik çekimleri ise 3D Secure'suz yapılıyor. O durumda her ay tek seferlik ödersin; dönemin bitmesine 3 gün kala hatırlatma e-postası göndeririz.",
  },
  {
    q: "Muhasebemi buradan tutabilir miyim?",
    a: "Panelde KASA bölümü var: giderlerini elle girersin (maaş, deterjan, yakıt, kira), tekrarlayanları bir kez tanımlayıp otomatiğe bağlarsın. Teslim ettiğin siparişlerin geliri kendiliğinden işlenir ve aylık kâr-zararın hesaplanır. Resmî faturalarının yerini tutmaz, işletmenin gerçek durumunu görmen içindir.",
  },
  {
    q: "Müşteri fiyatı nasıl görür?",
    a: "Profilinde m² bazlı tahmini fiyatların yazar. Halıyı alıp ölçtükten sonra kesin fiyatı panelden bildirirsin; müşteri onaylayınca yıkamaya başlarsın (yasal ispat platformda tutulur).",
  },
  {
    q: "İstediğim zaman ayrılabilir miyim?",
    a: "Evet. Abonelik ay bazında çalışır; yenilemediğinde profilin yayından iner, verilerin saklanır. Cezai şart yok.",
  },
];

export default async function ForBusinessesPage() {
  // Bekleyen müşteri talebi — halıcıya en güçlü satış argümanı gerçek veridir.
  const leads = await prisma.cityLead.groupBy({
    by: ["city"],
    _count: true,
    orderBy: { _count: { city: "desc" } },
    take: 8,
  });
  const totalLeads = leads.reduce((s, l) => s + l._count, 0);

  return (
    <>
      <main className="mx-auto w-full max-w-lg px-4 pb-12 md:max-w-3xl lg:max-w-5xl">
        <SiteHeader />

        <section className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">
            Halı yıkama işletmeleri için
          </p>
          {/* H1 DEĞİŞTİ (2026-07-29): eski başlık "Bölgendeki müşteriler seni
              bulsun — komisyonsuz sipariş kanalı" idi ve alt metin "müşteri
              arar, seni görür, siparişi verir" diyerek olmamış bir şeyi geniş
              zamanla olmuş gibi anlatıyordu. Ödenen bedelin karşılığı artık
              çalışan yazılım olarak anlatılıyor; keşif tarafı taahhütsüz ve
              tek cümleyle, en sonda. */}
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Halı yıkama işletmeni{" "}
            <span className="text-teal-300">tek panelden</span> yönet
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Şoförün haritada, halı hangi aşamada belli, teslim fotoğrafla
            kayıtta, ay sonunda kâr mı zarar mı ettiğin tek ekranda.
            Dükkânına gelen müşterini de panele yazar, takip kodunu kendin
            iletirsin. Bölgenin sayfasında da listelenirsin — oradan sipariş
            gelirse komisyon almayız.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/kayit"
              className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
            >
              İşletmeni ekle
            </Link>
            <Link
              href="/abonelik"
              className="text-sm font-medium text-teal-300 hover:underline"
            >
              Abonelik detayları →
            </Link>
          </div>
        </section>

        {/* TALEP ROZETİ EŞİĞİ (2026-07-29). Eskiden koşul `totalLeads > 0`'dı;
            canlıda toplam 1 kayıt olduğu için sayfa "Şu anda 1 müşteri,
            şehrinde halıcı açılmasını bekliyor — İstanbul: 1 kişi" diyordu.
            Halıcıya 2.400 TL'lik abonelik satan sayfada en büyük sayının 1
            olması, olmamasından KÖTÜ: talebin yokluğunu ilan ediyor. Sayı
            uydurulmuyor — anlamlı bir yığın oluşana kadar bölüm hiç
            gösterilmiyor, oluşunca kendiliğinden geliyor. Şehir rozetleri de
            tek kişilik şehirleri listelemesin diye ayrı eşikte. */}
        {totalLeads >= TALEP_ESIGI && (
          <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <h2 className="font-semibold text-amber-900">
              Şu anda {totalLeads} müşteri, şehrinde halıcı açılmasını bekliyor
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Henüz işletme olmayan şehir sayfalarımızda müşteriler
              &quot;açılınca haber ver&quot; kaydı bırakıyor. Şehrinde yayına
              girdiğin an bekleyenlere otomatik e-posta gider:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {leads
                .filter((l) => l._count >= SEHIR_ESIGI)
                .map((l) => (
                  <span
                    key={l.city}
                    className="rounded-full bg-white px-3 py-1 text-sm text-amber-900 shadow-sm"
                  >
                    {l.city}: <strong>{l._count} kişi</strong>
                  </span>
                ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="font-semibold text-slate-900">Neden buradasın?</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand-dark">
                  {p.icon}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  {p.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-semibold text-slate-900">
            Nasıl çalışır? (işletme gözünden)
          </h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Kaydol ve öde", "5 dakikada hesap aç, aboneliği başlat. Kart bilgilerin iyzico güvencesinde."],
              ["Profilini doldur", "Fiyat listesi, hizmet bölgeleri, fotoğraflar ve şoförünü ekle — otomatik yayına girersin."],
              // 3. ADIM DEĞİŞTİ (2026-07-29): eskiden "Sipariş düşsün —
              // bölgendeki müşteri siparişi verir" yazıyordu. Bu adım garanti
              // değil, dilek; halıcı 4 adımı okuyup abone oluyor, 3. adım
              // gerçekleşmiyordu. Yerine HER GÜN gerçekleşen adım kondu:
              // halıcının kendi müşterisini panele yazması.
              ["İşini panele al", "Dükkânına gelen müşteriyi panele yaz, takip kodunu ilet; siteden sipariş gelirse zilde anında görür, şoförüne atarsın."],
              ["Yıka, teslim et, kaydet", "Kesin fiyatı bildir, onay gelince yıka. Teslimde fotoğraf çekilir, ücretini alırsın; gelir deftere kendiliğinden düşer."],
            ].map(([t, d], i) => (
              <li
                key={t}
                className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="absolute right-3.5 top-3.5 text-xs font-semibold text-slate-500">
                  {i + 1}. adım
                </span>
                <h3 className="pr-12 text-sm font-semibold text-slate-900">{t}</h3>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <PlanCard wide ctaHref="/kayit" ctaLabel="Hemen Başla" />
        </section>

        <section className="mt-10">
          <h2 className="font-semibold text-slate-900">
            İşletmelerin sık sordukları
          </h2>
          <div className="mt-3 space-y-2.5">
            {FAQS.map((f) => (
              <details
                key={f.q}
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
          <p className="mt-4 text-sm text-slate-600">
            Aklına takılan başka bir şey mi var?{" "}
            <Link href="/iletisim" className="font-medium text-brand-dark hover:underline">
              Bize yaz
            </Link>{" "}
            ya da{" "}
            <Link href="/isletme-sozlesmesi" className="font-medium text-brand-dark hover:underline">
              işletme sözleşmesini
            </Link>{" "}
            incele.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
