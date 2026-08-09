import { merdivenAktif, merdiven, SOFOR_TAVANI, type Paket } from "@/lib/plan";
import { paketSec } from "@/app/panel/subscription-actions";
import { PendingButton } from "@/components/PendingButton";

/**
 * PAKET SEÇİCİ (2026-08-10).
 *
 * Merdiven ilk kurulduğunda fiyat işletmenin ŞOFÖR SAYISINDAN türetiliyordu,
 * yani paket DAYATILIYORDU: tek şoförü olan halıcı "sınırsız istiyorum"
 * diyemiyordu. Doğru yön ters — paketi işletme seçer, koltuk seçilen paketten
 * gelir, şoför ekleme o koltuğa kadar açılır.
 *
 * Fiyatlar `merdiven()`den okunur; burada elle yazılı rakam YOKTUR.
 */
export default function PaketSecici({
  mevcutPlan,
  mevcutKoltuk,
  talimatVar,
}: {
  mevcutPlan: Paket | string;
  mevcutKoltuk: number;
  talimatVar: boolean;
}) {
  if (!merdivenAktif) return null;
  const basamaklar = merdiven();
  const filoSecili = mevcutPlan === "FILO";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900">Paketin</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Kaç şoförle çalışacaksan onu seç. {SOFOR_TAVANI}. şoförden sonrası
        ücretsiz — sınırsız pakette şoför sayısı sınırlanmaz.
      </p>

      {talimatVar ? (
        // Aktif talimat varken paket değiştirilemez: iyzico'da çalışan planın
        // fiyatı değiştirilemiyor, başka plana geçiş talimatın iptali + kartın
        // yeniden alınması demek. Sessizce değiştirseydik panelde yeni fiyat
        // yazar, karttan ESKİ tutar çekilmeye devam ederdi.
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Düzenli ödeme talimatın aktif olduğu için paket buradan
          değiştirilemez. Önce talimatı iptal et (aşağıda), sonra paketini seçip
          kartını yeniden tanımla. Mevcut dönemin sonuna kadar yayında kalırsın.
        </p>
      ) : (
        <form action={paketSec} className="mt-3 space-y-2">
          {basamaklar.map((b, i) => {
            const koltuk = i + 1;
            const sinirsiz = b.sinirsiz;
            const deger = sinirsiz ? "FILO" : String(koltuk);
            const secili = sinirsiz
              ? filoSecili
              : !filoSecili && mevcutKoltuk === koltuk;
            return (
              <label
                key={deger}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition ${
                  secili
                    ? "border-brand bg-brand-light"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="secim"
                    value={deger}
                    defaultChecked={secili}
                    className="h-4 w-4 accent-brand"
                  />
                  <span className="text-sm text-slate-800">
                    {sinirsiz ? (
                      <>
                        <strong>Sınırsız şoför</strong> ({SOFOR_TAVANI}+)
                      </>
                    ) : (
                      <>
                        <strong>
                          {koltuk} şoför{koltuk === 1 ? "" : "e kadar"}
                        </strong>
                      </>
                    )}
                  </span>
                </span>
                <span className="whitespace-nowrap text-sm font-semibold text-slate-900">
                  {b.brut.toLocaleString("tr-TR")} TL/ay
                </span>
              </label>
            );
          })}
          <PendingButton className="mt-1 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-light">
            Paketi kaydet
          </PendingButton>
          <p className="text-xs text-slate-500">
            Tutarlar KDV dahildir. Paket değişikliği{" "}
            <strong>ödediğin dönemi kısaltmaz</strong>; yeni tutar bir sonraki
            ödemede geçerli olur.
          </p>
        </form>
      )}
    </section>
  );
}
