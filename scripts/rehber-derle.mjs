// REHBER DERLEYİCİ — repo kökündeki el kitaplarını TS modülüne gömer.
//
// NEDEN GEREKLİ: Dockerfile'ın çalışma katmanı yalnız `.next/standalone`,
// `public` ve `prisma` dizinlerini taşır — kökteki *.md dosyaları ÜRETİM
// İMAJINDA YOKTUR. Rehberleri çalışma anında `fs` ile okumaya kalkarsak
// sayfa canlıda 500 verir (yerelde çalışır, sunucuda çalışmaz — en kötü
// hata türü). Bu yüzden içerik DERLEME ANINDA `src/lib/rehberIcerik.ts`
// dosyasına gömülür; çalışma anında dosya sistemine hiç dokunulmaz.
//
// NE ZAMAN ÇALIŞIR: `npm run dev` ve `npm run build` öncesinde otomatik
// (package.json → predev / prebuild). Üretilen dosya git'e de commit edilir
// ki `npx tsc --noEmit` tek başına çalışabilsin.
//
// ⚠️ `src/lib/rehberIcerik.ts` ELLE DÜZENLENMEZ — kaynak, kökteki .md'lerdir.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const kok = join(dirname(fileURLToPath(import.meta.url)), "..");

// slug → kaynak dosya. Sıra önemsiz; gösterim sırası src/lib/rehberler.ts'te.
const KAYNAKLAR = [
  ["komisyoncu-rehberi", "KOMISYONCU-REHBERI.md"],
  ["bas-komisyoncu-rehberi", "BAS-KOMISYONCU-REHBERI.md"],
  ["pazarlamaci-el-kitabi", "PAZARLAMACI-EL-KITABI.md"],
  ["saha-karti", "SAHA-KARTI.md"],
];

const parcalar = [];
for (const [slug, dosya] of KAYNAKLAR) {
  let metin;
  try {
    metin = readFileSync(join(kok, dosya), "utf8");
  } catch {
    // Sessizce eksik içerik üretmektense derlemeyi durdur.
    console.error(`[rehber-derle] KAYNAK BULUNAMADI: ${dosya}`);
    process.exit(1);
  }
  const satirlar = metin.replace(/\r\n?/g, "\n").replace(/\s+$/, "").split("\n");
  parcalar.push(
    `  "${slug}": [\n${satirlar
      .map((s) => `    ${JSON.stringify(s)},`)
      .join("\n")}\n  ].join("\\n"),`,
  );
}

const cikti = `// OTOMATİK ÜRETİLDİ — ELLE DÜZENLEME.
// Kaynak: repo kökündeki el kitabı .md dosyaları.
// Üreten: scripts/rehber-derle.mjs (npm run predev / prebuild)
// Neden gömülü: üretim imajında kökteki .md dosyaları yok (bkz. betiğin başı).

export type RehberSlug =
${KAYNAKLAR.map(([s]) => `  | "${s}"`).join("\n")};

export const REHBER_MARKDOWN: Record<RehberSlug, string> = {
${parcalar.join("\n")}
};
`;

const hedef = join(kok, "src/lib/rehberIcerik.ts");
const eski = (() => {
  try {
    return readFileSync(hedef, "utf8");
  } catch {
    return null;
  }
})();
if (eski !== cikti) {
  writeFileSync(hedef, cikti, "utf8");
  console.log(`[rehber-derle] ${KAYNAKLAR.length} rehber gömüldü → ${hedef}`);
} else {
  console.log("[rehber-derle] değişiklik yok");
}
