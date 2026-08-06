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
      {/* Halı Bul */}
      <div className="h-6 w-40 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-56 rounded bg-slate-100" />
      <div className="mt-5 h-12 w-full rounded-lg bg-slate-100" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-slate-100 bg-white">
            <div className="aspect-square bg-slate-200" />
            <div className="p-2">
              <div className="h-3 w-3/4 rounded bg-slate-100" />
              <div className="mt-1.5 h-3 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
