"use client";

import { useEffect } from "react";

// Kök layout dahil her şey çökerse devreye giren son savunma hattı.
// Kendi <html>/<body> etiketlerini taşımak zorunda (layout render edilememiştir);
// bu yüzden Tailwind'e güvenmeden inline stillerle, error.tsx ile aynı dilde çizilir.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          backgroundColor: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            maxWidth: 448,
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Bir şeyler ters gitti
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#475569" }}>
            İşlem sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.
          </p>
          {error.digest ? (
            <p style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
              Hata kodu: <code>{error.digest}</code> — sorun sürerse bu kodu
              bize iletin.
            </p>
          ) : null}
          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button
              onClick={() => reset()}
              style={{
                borderRadius: 8,
                backgroundColor: "#0f766e",
                border: "none",
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 600,
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              Tekrar dene
            </button>
            <a
              href="/"
              style={{
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 600,
                color: "#334155",
                textDecoration: "none",
              }}
            >
              Ana sayfa
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
