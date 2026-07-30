// Sayfa yüklenirken içerik-şekilli iskelet (algılanan hızı artırır).
// En sık ana sayfada (force-dynamic) görünür.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-lg animate-pulse px-4 pb-12 md:max-w-3xl lg:max-w-5xl">
      {/* başlık */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-slate-200" />
          <div className="h-4 w-40 rounded bg-slate-200" />
        </div>
        <div className="h-4 w-24 rounded bg-slate-200" />
      </div>

      {/* arama kutusu */}
      <div className="mt-2 h-36 rounded-2xl bg-slate-100" />

      {/* satır başlığı */}
      <div className="mt-6 h-4 w-44 rounded bg-slate-200" />

      {/* kart ızgarası */}
      {/* İSKELET GERÇEK LİSTEYLE AYNI OLMALI (2026-07-30): burada
          `grid-cols-2` yazıyordu, gerçek liste ise `sm:grid-cols-2` —
          yani telefonda sayfa önce İKİ DAR kolon çiziyor, veri gelince TEK
          GENİŞ kolona zıplıyordu. Mobilde "yetersiz" hissinin görünür
          sebeplerinden biri bu sıçramaydı. */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-slate-100 bg-white"
          >
            <div className="aspect-[16/10] bg-slate-100" />
            <div className="space-y-2 p-3.5">
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
              <div className="mt-3 h-3 w-full rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
