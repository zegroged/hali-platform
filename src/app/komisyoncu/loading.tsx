// SAYFA YÜKLENİRKEN İSKELET (2026-07-31, kullanıcı bildirimi: "kod üretirken /
// hesap oluştururken bir süre beyaz ekran kalıyor, çok can sıkıcı").
// Bu segmentin loading.tsx'i YOKTU: ağır sorgular çalışırken Next hiçbir şey
// çizmiyor, kullanıcı bembeyaz ekrana bakıyordu. Panel'deki iskeletin aynısı.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl animate-pulse px-4 py-6 lg:max-w-5xl">
      <div className="h-6 w-40 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-64 rounded bg-slate-100" />
      <div className="mt-5 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="h-7 w-12 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="h-6 w-24 rounded-full bg-slate-100" />
            </div>
            <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
