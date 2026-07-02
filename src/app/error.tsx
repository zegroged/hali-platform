"use client";

import { useEffect } from "react";

// Sayfa render'ında beklenmeyen hata olursa kullanıcıya Türkçe, dostane ekran
// (beyaz ekran / İngilizce stack yerine). Tekrar dene butonu sağlar.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Destek tarafında sunucu loglarıyla eşleştirme için hatayı konsola yaz.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Bir şeyler ters gitti</h1>
      <p className="mt-2 text-sm text-slate-500">
        İşlem sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-slate-500">
          Hata kodu: <code>{error.digest}</code> — sorun sürerse bu kodu bize
          iletin.
        </p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
        >
          Tekrar dene
        </button>
        <a
          href="/"
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Ana sayfa
        </a>
      </div>
    </main>
  );
}
