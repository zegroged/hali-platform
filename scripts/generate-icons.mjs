// Tek seferlik ikon + OG görseli üretimi: `node scripts/generate-icons.mjs`
// Kaynak: public/icon.svg → apple-touch-icon (180, beyaz zemin), icon-192/512,
// favicon.ico (32px PNG gömülü geçerli ICO kabı) ve og.png (1200×630, markalı).
// sharp devDependency'dir; upload ucu da kullandığı için standalone build
// tarafından otomatik izlenip (file tracing) pakete dahil edilir.
import sharp from "sharp";
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const pub = path.join(process.cwd(), "public");
const svg = await readFile(path.join(pub, "icon.svg"));

// --- PNG ikonlar (SVG'yi yüksek yoğunlukta rasterize et, sonra hedefe küçült) ---
await sharp(svg, { density: 300 })
  .resize(192, 192)
  .png()
  .toFile(path.join(pub, "icon-192.png"));

await sharp(svg, { density: 300 })
  .resize(512, 512)
  .png()
  .toFile(path.join(pub, "icon-512.png"));

// apple-touch-icon: iOS şeffaf köşeleri siyah gösterir → beyaz zemine düzleştir.
await sharp(svg, { density: 300 })
  .resize(180, 180)
  .flatten({ background: "#ffffff" })
  .png()
  .toFile(path.join(pub, "apple-touch-icon.png"));

// --- favicon.ico: 32px PNG'yi geçerli bir ICO kabına göm ---
// (ICO formatı PNG gömülü girişleri destekler; bu uzantı hilesi değil,
// standarda uygun tek girişli bir .ico dosyasıdır.)
const png32 = await sharp(svg, { density: 300 }).resize(32, 32).png().toBuffer();
const ico = Buffer.alloc(22); // ICONDIR (6 bayt) + ICONDIRENTRY (16 bayt)
ico.writeUInt16LE(0, 0); // rezerve
ico.writeUInt16LE(1, 2); // tip: 1 = ikon
ico.writeUInt16LE(1, 4); // görüntü sayısı
ico.writeUInt8(32, 6); // genişlik
ico.writeUInt8(32, 7); // yükseklik
ico.writeUInt8(0, 8); // palet yok
ico.writeUInt8(0, 9); // rezerve
ico.writeUInt16LE(1, 10); // düzlem
ico.writeUInt16LE(32, 12); // bit/piksel
ico.writeUInt32LE(png32.length, 14); // veri boyutu
ico.writeUInt32LE(22, 18); // veri ofseti
await writeFile(path.join(pub, "favicon.ico"), Buffer.concat([ico, png32]));

// --- og.png (1200×630): marka zemini + logo + isim + slogan ---
// Inter yüklü olmayabilir → sistem fontu; jenerik "sans-serif" librsvg'de
// serif/mono'ya düşebildiği için açık yığın veriyoruz (Segoe UI/Arial → Windows).
const ogSvg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f766e"/>
  <circle cx="1080" cy="60" r="240" fill="#115e59" opacity="0.6"/>
  <circle cx="90" cy="590" r="200" fill="#0d9488" opacity="0.35"/>
  <g transform="translate(600,185) scale(5)">
    <g transform="translate(-32,-31.5)">
      <path d="M32 13c-7.2 0-13 5.8-13 13 0 9 13 24 13 24s13-15 13-24c0-7.2-5.8-13-13-13z" fill="#ffffff"/>
      <path d="M25 23h14M25 27h14M25 31h9" stroke="#0f766e" stroke-width="2.6" stroke-linecap="round"/>
    </g>
  </g>
  <text x="600" y="425" text-anchor="middle" font-family="'Segoe UI', Arial, 'Helvetica Neue', sans-serif" font-size="66" font-weight="700" fill="#ffffff">En Yakın Halı Yıkama</text>
  <text x="600" y="490" text-anchor="middle" font-family="'Segoe UI', Arial, 'Helvetica Neue', sans-serif" font-size="32" fill="#99f6e4">Kapından alınır, yıkanır, teslim edilir</text>
</svg>`;
await sharp(Buffer.from(ogSvg)).png().toFile(path.join(pub, "og.png"));

// --- Doğrulama: tüm çıktılar var ve boş değil ---
for (const f of [
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "favicon.ico",
  "og.png",
]) {
  const s = await stat(path.join(pub, f));
  if (s.size === 0) throw new Error(`${f} boş üretildi!`);
  console.log(`${f}: ${(s.size / 1024).toFixed(1)} KB`);
}
console.log("Tüm ikonlar üretildi.");
