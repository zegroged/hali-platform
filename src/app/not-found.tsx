import Link from "next/link";

// 404 — bulunamayan sayfa/sipariş/halıcı için Türkçe ekran.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Sayfa bulunamadı</h1>
      <p className="mt-2 text-sm text-slate-500">
        Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark"
      >
        Ana sayfaya dön
      </Link>
    </main>
  );
}
