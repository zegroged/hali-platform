import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // YAŞLI KULLANICI ÖLÇEĞİ (2026-07-30): halıcıların büyük kısmı 50-65 yaş
      // aralığında ve paneli telefondan kullanıyor. Tailwind'in varsayılan
      // ölçeği (xs=12px, sm=14px, base=16px) bu göz için küçük kalıyordu;
      // panelde 206 yerde `text-xs` vardı. 206 dosyayı tek tek değiştirmek
      // yerine ÖLÇEĞİN KENDİSİ büyütüldü — tek kaynak, tüm site.
      // Artış ölçülü tutuldu (%6-8): daha fazlası mevcut yerleşimlerde taşma
      // yapar. Asıl okunabilirlik kazancı kontrast düzeltmesinde (gri tonları).
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.125rem" }], // 12 → 13
        sm: ["0.9375rem", { lineHeight: "1.375rem" }], // 14 → 15
        base: ["1.0625rem", { lineHeight: "1.625rem" }], // 16 → 17
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        // KONTRAST DÜZELTMESİ (2026-07-30) — yaşlı kullanıcı için asıl kazanç.
        // Ölçüm: `text-slate-400` 81 yerde, beyaz zeminde kontrast oranı 2.85:1
        // (erişilebilirlik eşiği 4.5:1) — yaşan gözü bunu okuyamıyor.
        // `text-slate-500` 317 yerde, 4.76:1 ile sınırda geçiyor.
        // ⚠️ Bu iki ton src genelinde YALNIZCA metin rengi olarak kullanılıyor
        // (bg-/border-/ring- eşleniği HİÇ YOK — grep ile doğrulandı), bu yüzden
        // tonu kaynağında koyulaştırmak 398 dosyaya dokunmadan güvenli.
        slate: {
          400: "#64748b", // eski 500 tonu → 4.76:1 (AA geçer)
          500: "#475569", // eski 600 tonu → 7.44:1 (AAA, yaşlı göz için rahat)
        },
        brand: {
          // DEFAULT beyaz metinle WCAG AA (≥4.5:1) verecek tonda tutulur;
          // #0d9488 (3.75:1) yalnız vurgu/ikon tonu olarak "bright" adıyla durur.
          DEFAULT: "#0f766e",
          bright: "#0d9488",
          dark: "#115e59",
          light: "#ccfbf1",
        },
      },
    },
  },
  plugins: [],
};

export default config;
