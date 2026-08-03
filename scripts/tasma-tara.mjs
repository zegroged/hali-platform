// MOBİL TAŞMA TARAYICI
// Sarmayan (flex-wrap / flex-col olmayan) yatay flex satırlarını bulur, o
// satırın İÇİNDEKİ sabit genişlikli çocukları toplayıp tahmini en hesaplar.
// 360px telefonda kart içi kullanılabilir en ≈ 294px (px-4 + p-4).
import fs from "node:fs";
import path from "node:path";

const KOK = ["src/app", "src/components"];
const SINIR = 294; // 360px telefonda kart içi genişlik

// Tailwind w-N → piksel (N * 4)
const W = /\bw-(\d+)\b/g;
// Kabaca: select ~ en uzun seçeneğe göre büyür, buton metne göre.
const TAHMIN = { select: 170, buton: 120, input: 0 };

function dosyalar(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) dosyalar(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const bulgular = [];
for (const kok of KOK) {
  if (!fs.existsSync(kok)) continue;
  for (const dosya of dosyalar(kok)) {
    if (dosya.includes("loading.tsx")) continue; // iskeletler, gerçek içerik değil
    const satirlar = fs.readFileSync(dosya, "utf8").split("\n");
    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i];
      const m = s.match(/className=\{?["`]([^"`]*\bflex\b[^"`]*)["`]/);
      if (!m) continue;
      const cls = m[1];
      if (!/\bflex\b/.test(cls)) continue;
      if (/flex-col|flex-wrap/.test(cls)) continue; // zaten güvenli
      if (!/items-(end|center|start|baseline)|justify-/.test(cls)) continue;

      // Satırın kapsamı: girinti aynı seviyeye dönene kadar (Prettier düzeni).
      const girinti = s.search(/\S/);
      let en = 0;
      const parcalar = [];
      for (let j = i + 1; j < Math.min(i + 70, satirlar.length); j++) {
        const t = satirlar[j];
        const g = t.search(/\S/);
        if (t.trim() && g <= girinti) break; // kapsam bitti
        let w;
        W.lastIndex = 0;
        while ((w = W.exec(t))) {
          const n = Number(w[1]);
          if (n >= 20 && n <= 96) {
            // w-full / w-1/2 gibi oranlar yakalanmaz (rakam değil) — iyi.
            if (!/max-w|min-w|sm:w-|md:w-|lg:w-/.test(t)) {
              en += n * 4;
              parcalar.push(`w-${n}(${n * 4}px)`);
            }
          }
        }
        if (/<select/.test(t)) {
          en += TAHMIN.select;
          parcalar.push("select(~170px)");
        }
        // YALNIZ AÇILIŞ ETİKETİ: `</PendingButton>` de sayılınca butonlar iki
        // katına çıkıyordu ve sahte bulgu üretiyordu.
        if (/<PendingButton|<button|<ConfirmButton/.test(t)) {
          en += TAHMIN.buton;
          parcalar.push("buton(~120px)");
        }
      }
      if (en > SINIR) {
        bulgular.push({
          dosya: dosya.replace(/\\/g, "/"),
          satir: i + 1,
          en,
          parcalar: parcalar.join(" + "),
          cls: cls.slice(0, 60),
        });
      }
    }
  }
}

bulgular.sort((a, b) => b.en - a.en);
console.log(`${bulgular.length} riskli satır (tahmini en > ${SINIR}px):\n`);
for (const b of bulgular) {
  console.log(`${b.en}px  ${b.dosya}:${b.satir}`);
  console.log(`       ${b.parcalar}`);
}
