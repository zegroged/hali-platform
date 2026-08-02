// REHBER KONTROLÜ — `npm run test:rehber`
//
// NEDEN VAR: rehber .md dosyaları elle güncelleniyor ve HTML'e küçük bir
// kendi çeviricimizle dönüyor (src/lib/markdownMini.ts). Biri dosyaya
// çeviricinin bilmediği bir yapı yazarsa (iç içe liste, ham HTML...) sonuç
// SESSİZCE bozuk çıkar — panelde "**kalın**" gibi çiğ işaretler görünür.
// Bu betik hem çevirinin artık bırakmadığını hem de yetki süzgecinin
// (baş komisyoncu rehberi alt kademeye açılmıyor) çalıştığını doğrular.
//
// İsteğe bağlı: `npx tsx scripts/rehber-kontrol.ts <dizin>` verilirse
// indirilecek HTML dosyalarının birebir aynısını o dizine yazar (gözle
// bakmak için).

import { writeFileSync } from "node:fs";
import {
  REHBERLER,
  rehberBelgesi,
  rehberBul,
  rehberGovdesi,
  rehberleriListele,
} from "../src/lib/rehberler";

const cikisDizin = process.argv[2] ?? null;
let hata = 0;
const kontrol = (ad: string, kosul: boolean) => {
  console.log((kosul ? "  ✓ " : "  ✗ ") + ad);
  if (!kosul) hata++;
};

console.log("— Çeviri artıkları —");
for (const r of REHBERLER) {
  const govde = rehberGovdesi(r);
  const artiklar: string[] = [];
  if (/\*\*/.test(govde)) artiklar.push("çözülmemiş **");
  if (/<p>\|/.test(govde)) artiklar.push("paragrafa düşmüş tablo satırı");
  if (/<p>#{1,6}\s/.test(govde)) artiklar.push("paragrafa düşmüş başlık");
  if (/<p>-\s/.test(govde)) artiklar.push("paragrafa düşmüş liste");
  if (!/<h1[\s>]/.test(govde)) artiklar.push("başlık üretilmemiş");
  kontrol(
    `${r.slug} temiz çevrildi`,
    artiklar.length === 0,
  );
  if (artiklar.length) console.log("      " + artiklar.join(" · "));

  if (cikisDizin) {
    writeFileSync(
      `${cikisDizin}/${r.dosyaAdi}.html`,
      rehberBelgesi(
        r.baslik,
        [{ id: `r-${r.slug}`, baslik: r.baslik, govde }],
        "önizleme",
      ),
      "utf8",
    );
  }
}

console.log("— Yetki süzgeci —");
const bas = rehberleriListele(true).map((r) => r.slug);
const alt = rehberleriListele(false).map((r) => r.slug);
kontrol("baş komisyoncu tüm rehberleri görür", bas.length === REHBERLER.length);
kontrol(
  "alt komisyoncu BAŞ rehberini GÖRMEZ",
  !alt.includes("bas-komisyoncu-rehberi") && alt.length === REHBERLER.length - 1,
);
kontrol(
  "alt komisyoncu BAŞ rehberini AÇAMAZ",
  rehberBul("bas-komisyoncu-rehberi", false) === null,
);
kontrol(
  "baş komisyoncu BAŞ rehberini açar",
  rehberBul("bas-komisyoncu-rehberi", true) !== null,
);
kontrol(
  "geçersiz slug reddedilir",
  rehberBul("../../.env", true) === null && rehberBul("tumu", true) === null,
);
kontrol(
  "indirme dosya adları ASCII",
  REHBERLER.every((r) => /^[A-Za-z0-9-]+$/.test(r.dosyaAdi)),
);

if (cikisDizin) {
  writeFileSync(
    `${cikisDizin}/Komisyoncu-Rehberleri-Tumu.html`,
    rehberBelgesi(
      "Komisyoncu Rehberleri",
      REHBERLER.map((r) => ({
        id: `r-${r.slug}`,
        baslik: r.baslik,
        govde: rehberGovdesi(r),
      })),
      "önizleme",
    ),
    "utf8",
  );
  console.log(`\nÖnizleme dosyaları yazıldı: ${cikisDizin}`);
}

console.log(hata ? `\n${hata} KONTROL BAŞARISIZ` : "\nTÜM KONTROLLER GEÇTİ");
process.exit(hata ? 1 : 0);
