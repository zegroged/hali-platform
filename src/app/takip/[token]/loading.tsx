// Takip sayfası yüklenirken zaman çizelgesi şekilli iskelet — nihai düzenle
// aynı boyutlarda olduğundan içerik gelince ekran zıplamaz.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-lg animate-pulse px-4 py-6">
      {/* başlık + kod */}
      <div className="h-6 w-48 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-32 rounded bg-slate-100" />

      {/* halıcı / telefon satırı */}
      <div className="mt-4 h-10 w-44 rounded-lg bg-slate-100" />

      {/* zaman çizelgesi */}
      <div className="mt-6 space-y-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="h-3 w-1/4 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
