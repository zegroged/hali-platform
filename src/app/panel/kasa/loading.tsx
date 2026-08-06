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
      {/* Kasa */}
      <div className="h-6 w-40 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-56 rounded bg-slate-100" />
      <div className="mt-5 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="mt-3 space-y-3">
              <div className="h-10 w-full rounded-lg bg-slate-100" />
              <div className="h-10 w-full rounded-lg bg-slate-100" />
              <div className="h-10 w-2/3 rounded-lg bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
