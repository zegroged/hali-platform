import Link from "next/link";
import { IconCheck } from "@/components/icons";
import { PLAN, merdivenAktif, merdiven, SOFOR_TAVANI } from "@/lib/plan";

// FİYAT MERDİVENİ ŞERİDİ (FIYAT-2026-08-09.md §1-A).
// Kartta görünen rakam TABAN basamaktır (1 şoför). Ek şoför ve tavan burada
// yazılmazsa halıcı "900" görüp iki şoförle 1.200 ödediğini kasada öğrenir —
// sürprizin adı chargeback'tir. Fiyat tablosu VERİDEN basılır (elle liste yok).
const tl = (n: number) => n.toLocaleString("tr-TR");
function Merdiven({ koyu = false }: { koyu?: boolean }) {
  if (!merdivenAktif) return null;
  const basamaklar = merdiven();
  return (
    <div
      className={`mt-3 rounded-xl border p-3 text-xs ${
        koyu
          ? "border-white/25 bg-white/10 text-teal-50"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <p className={koyu ? "font-medium text-white" : "font-medium text-slate-800"}>
        Şoför sayısına göre
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {basamaklar.map((b, i) => (
          <li key={b.brut} className="flex justify-between gap-3">
            <span>
              {b.sinirsiz ? `${SOFOR_TAVANI}+ şoför (sınırsız)` : `${i + 1} şoför`}
            </span>
            <span className={koyu ? "font-semibold text-white" : "font-semibold text-slate-900"}>
              {tl(b.brut)} TL/ay
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5">
        Tutarlar KDV dahil. {SOFOR_TAVANI}. şoförden sonrası ücretsiz.
      </p>
    </div>
  );
}

/**
 * Fiyatlandırma kartı — tek pakete tek kart. İki düzen:
 *  - dar (varsayılan): ana sayfadaki CTA sütununda, tek kolon.
 *  - wide: /kayit ve /abonelik hero'sunda ekranı dolduran iki kolon
 *    (solda marka + fiyat + CTA, sağda faydalar). İçerik src/lib/plan.ts'ten.
 */
export default function PlanCard({
  ctaHref,
  onCta,
  ctaLabel = "Hemen Başla",
  wide = false,
}: {
  /** Link olarak davran (ana sayfa, /abonelik) */
  ctaHref?: string;
  /** Buton olarak davran (/kayit: tıklayınca form açılır) */
  onCta?: () => void;
  ctaLabel?: string;
  /** Geniş, ekranı dolduran iki kolonlu düzen */
  wide?: boolean;
}) {
  // Günlük karşılık: saha satış dili fiyatı hep günlük hesapla veriyor
  // (Pazarlamacı El Kitabı §4). Önce sabit "80" yazılıydı; merdivende taban
  // 900 → 30 lira. Rakam artık fiyattan türetiliyor, elle yazılmıyor.
  const gunluk = Math.round(PLAN.priceGrossNumber / 30);

  const ctaCls =
    "block w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99]";
  const Cta = onCta ? (
    <button type="button" onClick={onCta} className={ctaCls}>
      {ctaLabel}
    </button>
  ) : (
    <Link href={ctaHref ?? "/kayit"} className={ctaCls}>
      {ctaLabel}
    </Link>
  );

  // "Günde ~80 lira" (2026-08-03): 2.400 tek başına büyük duruyor; sahadaki
  // satış dili de fiyatı hep günlük hesapla veriyor (Pazarlamacı El Kitabı §4).
  const Price = (
    <>
      <p>
        <span className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          ₺{PLAN.priceAmount}
        </span>
        <span className="text-sm font-medium text-slate-500"> + KDV / ay</span>
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Aylık {PLAN.priceGrossMonthly} TL — günde yaklaşık {gunluk} lira.
      </p>
    </>
  );

  const Features = (
    <ul className={wide ? "grid gap-x-6 gap-y-3 sm:grid-cols-2" : "space-y-2.5"}>
      {PLAN.features.map((f) => (
        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
          <span className="mt-0.5 shrink-0 text-brand-bright">
            <IconCheck size={15} />
          </span>
          {f}
        </li>
      ))}
    </ul>
  );

  if (wide) {
    return (
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Sol: marka + fiyat + CTA (renkli panel, dikkat çeker) */}
        <div className="flex flex-col justify-center gap-4 bg-gradient-to-br from-brand to-brand-dark p-8 text-white">
          <div>
            <h2 className="text-xl font-bold">{PLAN.name}</h2>
            <p className="mt-1 text-sm text-teal-50">
              {merdivenAktif
                ? "Şoför sayısına göre, gizli ücret yok."
                : "Tek paket, gizli ücret yok."}
            </p>
          </div>
          <div>
            <p>
              <span className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                ₺{PLAN.priceAmount}
              </span>
              <span className="text-sm font-medium text-teal-50"> + KDV / ay</span>
            </p>
            <p className="mt-1 text-sm text-teal-50">
              Aylık {PLAN.priceGrossMonthly} TL — günde yaklaşık {gunluk} lira.
            </p>
            <Merdiven koyu />
          </div>
          {onCta ? (
            <button
              type="button"
              onClick={onCta}
              className="block w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-brand-dark transition hover:bg-teal-50 active:scale-[0.99]"
            >
              {ctaLabel}
            </button>
          ) : (
            <Link
              href={ctaHref ?? "/kayit"}
              className="block w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-brand-dark transition hover:bg-teal-50 active:scale-[0.99]"
            >
              {ctaLabel}
            </Link>
          )}
        </div>
        {/* Sağ: faydalar (ekranı doldurur) */}
        <div className="p-8">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pakete dahil olan her şey
          </h3>
          {Features}
        </div>
      </section>
    );
  }

  return (
    <section className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{PLAN.name}</h2>
      <div className="mt-2">{Price}</div>
      <Merdiven />
      <div className="mt-5">{Features}</div>
      <div className="mt-6">{Cta}</div>
    </section>
  );
}
