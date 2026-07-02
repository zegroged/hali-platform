// Halıcı profili yüklenirken sayfa şekilli iskelet: başlık + foto şeridi +
// fiyat tablosu. Kök loading'in ana-sayfa-şekli buraya uymuyordu (zıplama).
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-lg animate-pulse px-4 py-6 pb-28 md:max-w-3xl lg:max-w-5xl">
      {/* geri linki */}
      <div className="h-4 w-24 rounded bg-slate-200" />

      {/* başlık + puan */}
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-7 w-2/3 rounded bg-slate-200" />
          <div className="h-4 w-1/3 rounded bg-slate-100" />
        </div>
        <div className="space-y-2">
          <div className="h-6 w-14 rounded bg-slate-200" />
          <div className="h-3 w-14 rounded bg-slate-100" />
        </div>
      </div>

      {/* rozetler */}
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-24 rounded-full bg-slate-100" />
        <div className="h-6 w-20 rounded-full bg-slate-100" />
      </div>

      {/* fotoğraf şeridi */}
      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={`aspect-[4/3] rounded-lg bg-slate-100 ${
              i === 2 ? "hidden md:block" : ""
            }`}
          />
        ))}
      </div>

      {/* teslim rozeti */}
      <div className="mt-4 h-9 w-56 rounded-lg bg-slate-100" />

      {/* fiyat tablosu */}
      <div className="mt-6 h-5 w-32 rounded bg-slate-200" />
      <div className="mt-2 overflow-hidden rounded-lg border border-slate-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 last:border-0"
          >
            <div className="h-4 w-1/3 rounded bg-slate-100" />
            <div className="h-4 w-20 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* çalışma saatleri */}
      <div className="mt-6 h-5 w-40 rounded bg-slate-200" />
      <div className="mt-2 h-40 rounded-lg border border-slate-100 bg-slate-50" />
    </main>
  );
}
