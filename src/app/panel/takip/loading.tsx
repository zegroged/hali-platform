// SAYFA İSKELETİ (2026-08-06).
//
// SORUN (ölçüldü): panelin sunucu render'ı 207-478 ms sürüyor. `/panel`'de
// iskelet vardı ama 12 alt sayfanın HİÇBİRİNDE yoktu — linke basıldığında
// sayfa gelene kadar EKRANDA HİÇBİR ŞEY OLMUYOR, kullanıcı "bastım, tepki
// yok" diye algılıyordu. Kullanıcının "akışkanlık yok, bütün sayfalarda
// aynı" dediği şey buydu.
//
// Next App Router `loading.tsx`'i tıklama ANINDA gösterir; sunucu arkada
// çalışmaya devam eder. Sayfa hızlanmıyor, ama BEKLEME GÖRÜNÜR oluyor —
// algılanan hızda en büyük fark bu.

export default function Loading() {
  return (
    <div className="w-full animate-pulse py-4">
      {/* Canlı Takip */}
      <div className="h-6 w-40 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-56 rounded bg-slate-100" />
      <div className="mt-5 h-[360px] w-full rounded-xl bg-slate-200 lg:h-[480px]" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-white p-3">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-40 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
