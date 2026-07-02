import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
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
