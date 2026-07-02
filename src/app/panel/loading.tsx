// Panel sayfaları yüklenirken kart şekilli iskelet (layout'un header/nav'ı
// zaten görünür; burada yalnız içerik alanı temsil edilir).
export default function Loading() {
  return (
    <div className="w-full animate-pulse">
      {/* sayfa başlığı */}
      <div className="h-6 w-40 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-64 rounded bg-slate-100" />

      {/* rozet/filtre satırı */}
      <div className="mt-5 flex gap-2">
        <div className="h-8 w-24 rounded-full bg-slate-100" />
        <div className="h-8 w-28 rounded-full bg-slate-100" />
        <div className="h-8 w-20 rounded-full bg-slate-100" />
      </div>

      {/* istatistik kartları */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-100 bg-white p-4"
          >
            <div className="h-7 w-12 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* liste kartları */}
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-100 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="h-6 w-24 rounded-full bg-slate-100" />
            </div>
            <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
            <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
