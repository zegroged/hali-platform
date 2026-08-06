// PLAY EKRAN GÖRÜNTÜSÜ HAZIRLAYICI
//
// SORUN: Google Play mağaza girişi ekran görüntülerinde **16:9 veya 9:16** oran
// istiyor. Modern telefonlar 20:9 çekiyor (ör. 1080×2400) — yani ham ekran
// görüntüsü 9:16'dan DAHA UZUN ve Play reddediyor. Elle kırpmak zahmetli ve
// her seferinde farklı oran çıkıyor.
//
// ÇÖZÜM: dikeyden ortalayarak kırp, 1080×1920'ye getir. Kırpılan yerler zaten
// atılacak kısımlar: üstte saat/pil şeridi, altta gezinme çubuğu. Yani hem
// oran tutuyor hem görüntü temizleniyor.
//
// KULLANIM:
//   node scripts/play-ekran.mjs <klasör|dosya...> [--cikti <klasör>]
// Örnek:
//   node scripts/play-ekran.mjs "C:/Users/yilma/Desktop/ss"
//   node scripts/play-ekran.mjs a.png b.png --cikti C:/Users/yilma/Desktop/play
//
// Varsayılan çıktı: <girdi klasörü>/play-hazir
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const HEDEF_EN = 1080;
const HEDEF_BOY = 1920; // 9:16
const UZANTI = /\.(png|jpe?g)$/i;

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.log(
    "Kullanım: node scripts/play-ekran.mjs <klasör|dosya...> [--cikti <klasör>]",
  );
  process.exit(1);
}

let cikti = null;
const girdiler = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--cikti") {
    cikti = argv[++i];
  } else {
    girdiler.push(argv[i]);
  }
}

/** Klasör verildiyse içindeki görselleri topla. */
function dosyalariTopla(girdiler) {
  const liste = [];
  for (const g of girdiler) {
    if (!fs.existsSync(g)) {
      console.error(`⚠️  bulunamadı, atlandı: ${g}`);
      continue;
    }
    if (fs.statSync(g).isDirectory()) {
      for (const ad of fs.readdirSync(g)) {
        if (UZANTI.test(ad) && !ad.startsWith("play-")) {
          liste.push(path.join(g, ad));
        }
      }
    } else if (UZANTI.test(g)) {
      liste.push(g);
    }
  }
  return liste;
}

const dosyalar = dosyalariTopla(girdiler);
if (dosyalar.length === 0) {
  console.error("Görsel bulunamadı (png/jpg).");
  process.exit(1);
}

const ciktiKlasor =
  cikti ?? path.join(path.dirname(dosyalar[0]), "play-hazir");
fs.mkdirSync(ciktiKlasor, { recursive: true });

console.log(`${dosyalar.length} görsel · çıktı: ${ciktiKlasor}\n`);

let basarili = 0;
for (const dosya of dosyalar) {
  try {
    const gorsel = sharp(dosya);
    const { width: w, height: h } = await gorsel.metadata();
    if (!w || !h) throw new Error("ölçü okunamadı");

    // Hedef oranda (9:16) kırpma kutusu hesapla.
    const oran = w / h;
    const hedefOran = HEDEF_EN / HEDEF_BOY; // 0.5625
    let kes;
    if (oran < hedefOran) {
      // Görsel FAZLA UZUN (telefon ekranı) → dikeyden ortalayarak kırp.
      // Üstteki durum çubuğu ve alttaki gezinme çubuğu böylece gider.
      const yeniBoy = Math.round(w / hedefOran);
      kes = { left: 0, top: Math.round((h - yeniBoy) / 2), width: w, height: yeniBoy };
    } else if (oran > hedefOran) {
      // Görsel fazla geniş → yatayda ortalayarak kırp.
      const yeniEn = Math.round(h * hedefOran);
      kes = { left: Math.round((w - yeniEn) / 2), top: 0, width: yeniEn, height: h };
    } else {
      kes = { left: 0, top: 0, width: w, height: h };
    }

    const ad = path.basename(dosya).replace(UZANTI, "") + "-play.png";
    const hedefYol = path.join(ciktiKlasor, ad);
    await gorsel
      .extract(kes)
      .resize(HEDEF_EN, HEDEF_BOY, { fit: "fill" })
      .png({ quality: 92 })
      .toFile(hedefYol);

    const kb = Math.round(fs.statSync(hedefYol).size / 1024);
    console.log(`✓ ${path.basename(dosya)}  ${w}×${h} → 1080×1920  (${kb} KB)`);
    basarili++;
  } catch (e) {
    console.error(`✗ ${path.basename(dosya)}: ${e.message}`);
  }
}

console.log(
  `\n${basarili}/${dosyalar.length} hazır. Play'e bu klasördeki dosyaları yükle:\n${ciktiKlasor}`,
);
console.log(
  "Not: Play en az 2, en fazla 8 telefon ekran görüntüsü istiyor; 8 MB sınırı var.",
);
