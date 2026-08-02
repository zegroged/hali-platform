import { REHBER_MARKDOWN, type RehberSlug } from "./rehberIcerik";
import { markdownHtml } from "./markdownMini";

// KOMİSYONCU REHBERLERİ (2026-08-02)
//
// Dört el kitabı komisyoncu panelinden okunur ve tek tıkla, kendi kendine
// yeten bir HTML dosyası olarak indirilir (çevrimdışı da açılır).
//
// 🔴 YETKİ AYRIMI — İŞİN KRİTİK NOKTASI: BAŞ KOMİSYONCU REHBERİ havuz payı
// matematiğini (alt komisyoncuya verilen yüzde ile başın payı arasındaki
// farkı) içerir. Alt komisyoncu bunu görürse kendi oranını pazarlık masasına
// taşır. Bu yüzden `yalnizBas` işaretli rehber HEM listede süzülür HEM de
// okuma/indirme yollarında sunucuda ayrıca kontrol edilir — arayüzde
// gizlemek YETMEZ (bkz. app-router-auth-leak dersi).

export type Rehber = {
  slug: RehberSlug;
  baslik: string;
  ozet: string;
  ikon: string;
  /** İndirilen dosyanın ASCII adı (Türkçe karakter tarayıcıda bozulabiliyor). */
  dosyaAdi: string;
  /** true → yalnız baş komisyoncu görür/indirir. */
  yalnizBas: boolean;
  /** true → baş komisyoncu için "ekibine vereceğin sürüm" etiketi taşır. */
  ekibeVerilir: boolean;
};

// Sıra = panelde görünme sırası (baş komisyoncuda kendi rehberi başa alınır).
export const REHBERLER: Rehber[] = [
  {
    slug: "bas-komisyoncu-rehberi",
    baslik: "Baş Komisyoncu Rehberi",
    ozet:
      "Havuz payı matematiği, ekip kurma, yetki devri. Yalnız sana açıktır — ekibinle paylaşma.",
    ikon: "👑",
    dosyaAdi: "Bas-Komisyoncu-Rehberi",
    yalnizBas: true,
    ekibeVerilir: false,
  },
  {
    slug: "komisyoncu-rehberi",
    baslik: "Komisyoncu Rehberi",
    ozet:
      "Sistemin kullanımı: kod üretme, kazanç takibi, ay sonu ödeme, indirim ve deneme yetkisi.",
    ikon: "📘",
    dosyaAdi: "Komisyoncu-Rehberi",
    yalnizBas: false,
    ekibeVerilir: true,
  },
  {
    slug: "pazarlamaci-el-kitabi",
    baslik: "Pazarlamacı El Kitabı",
    ozet:
      "Satışın tamamı: ne anlatacaksın, hangi itiraza ne diyeceksin, satışı nasıl kapatacaksın.",
    ikon: "📕",
    dosyaAdi: "Pazarlamaci-El-Kitabi",
    yalnizBas: false,
    ekibeVerilir: false,
  },
  {
    slug: "saha-karti",
    baslik: "Saha Kartı (tek sayfa)",
    ozet:
      "Dükkân kapısında telefondan bakılacak özet: dertler, fiyat, üç itiraz, yasak cümleler.",
    ikon: "📄",
    dosyaAdi: "Saha-Karti",
    yalnizBas: false,
    ekibeVerilir: false,
  },
];

/** Rolüne göre görebileceği rehberler. */
export function rehberleriListele(basKomisyoncu: boolean): Rehber[] {
  return REHBERLER.filter((r) => basKomisyoncu || !r.yalnizBas);
}

/** Slug → rehber; yetkisi yoksa (ya da slug yoksa) null. */
export function rehberBul(slug: string, basKomisyoncu: boolean): Rehber | null {
  const r = REHBERLER.find((x) => x.slug === slug);
  if (!r) return null;
  if (r.yalnizBas && !basKomisyoncu) return null;
  return r;
}

/** Rehberin markdown gövdesinin HTML karşılığı. */
export function rehberGovdesi(r: Rehber): string {
  return markdownHtml(REHBER_MARKDOWN[r.slug]);
}

// ——— Görünüm ———
// Tek kaynak: aynı CSS hem panel içi okuma ekranında hem de indirilen
// dosyada kullanılır, böylece ikisi birbirinden ayrı düşmez.

/** Rehber gövdesinin biçimi (.rehber kapsayıcısı içinde geçerli). */
export const REHBER_ICERIK_CSS = `
.rehber { color: #1e293b; line-height: 1.7; font-size: 17px; overflow-wrap: break-word; }
.rehber > :first-child { margin-top: 0; }
.rehber h1 { font-size: 1.6em; font-weight: 800; margin: 1.6em 0 .2em; color: #0f172a; letter-spacing: -.01em; }
.rehber h1 + h2 { margin-top: 0; color: #475569; font-weight: 600; font-size: 1.05em; border: 0; padding: 0; }
.rehber h2 { font-size: 1.25em; font-weight: 700; margin: 1.8em 0 .5em; color: #0f172a; border-top: 1px solid #e2e8f0; padding-top: .9em; }
/* "---" ardından gelen başlıkta çift çizgi olmasın (hr + h2 kenarlığı). */
.rehber hr + h2 { border-top: 0; padding-top: 0; margin-top: 0; }
.rehber hr + h1 { margin-top: 0; }
.rehber h3 { font-size: 1.08em; font-weight: 700; margin: 1.4em 0 .4em; color: #115e59; }
.rehber h4, .rehber h5, .rehber h6 { font-size: 1em; font-weight: 700; margin: 1.2em 0 .3em; }
.rehber p { margin: .7em 0; }
.rehber ul, .rehber ol { margin: .7em 0; padding-left: 1.35em; }
.rehber li { margin: .35em 0; }
.rehber strong { color: #0f172a; font-weight: 700; }
.rehber a { color: #115e59; }
.rehber code { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 5px; padding: .1em .35em; font-size: .9em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.rehber hr { border: 0; border-top: 1px solid #e2e8f0; margin: 1.8em 0; }
.rehber blockquote { margin: 1em 0; padding: .8em 1em; border-left: 4px solid #0f766e; background: #f0fdfa; border-radius: 0 10px 10px 0; }
.rehber blockquote > :first-child { margin-top: 0; }
.rehber blockquote > :last-child { margin-bottom: 0; }
.rehber .tablo-kutu { overflow-x: auto; margin: 1em 0; -webkit-overflow-scrolling: touch; }
.rehber table { border-collapse: collapse; width: 100%; font-size: .95em; }
.rehber th, .rehber td { border: 1px solid #e2e8f0; padding: .5em .7em; vertical-align: top; }
.rehber th { background: #f8fafc; font-weight: 700; color: #0f172a; }
.rehber tbody tr:nth-child(even) { background: #fcfdfe; }
`.trim();

/** İndirilen dosyanın sayfa çatısı (panel içinde kullanılmaz). */
const BELGE_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
.sayfa { max-width: 46rem; margin: 0 auto; padding: 1.5rem 1.1rem 4rem; }
.ust { background: #0f766e; color: #fff; padding: 1rem 1.1rem; }
.ust .marka { max-width: 46rem; margin: 0 auto; font-weight: 700; letter-spacing: .01em; }
.ust .not { max-width: 46rem; margin: .2rem auto 0; font-size: .82rem; color: #ccfbf1; }
.kart { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.6rem 1.4rem; }
.dizin { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.1rem 1.4rem; margin-bottom: 1rem; }
.dizin h2 { margin: 0 0 .5rem; font-size: 1rem; color: #0f172a; }
.dizin ol { margin: 0; padding-left: 1.2rem; color: #334155; }
.dizin a { color: #115e59; }
.alt { margin-top: 1.2rem; font-size: .8rem; color: #475569; text-align: center; line-height: 1.6; }
.sayfa-sonu { border: 0; border-top: 2px dashed #cbd5e1; margin: 2.5rem 0; }
@media print {
  body { background: #fff; }
  .ust { background: #fff; color: #0f172a; border-bottom: 2px solid #0f766e; }
  .ust .not { color: #475569; }
  .kart, .dizin { border: 0; padding: 0; }
  .sayfa { max-width: none; padding: 0; }
  .sayfa-sonu { page-break-before: always; border: 0; margin: 0; }
  .rehber h2, .rehber h3 { page-break-after: avoid; }
  .rehber table, .rehber blockquote, .rehber li { page-break-inside: avoid; }
}
`.trim();

function kacir(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Kendi kendine yeten HTML belgesi üretir: dış kaynak yok, çevrimdışı açılır,
 * telefonda okunur, yazdırılabilir.
 *
 * @param baslik  <title> ve sekme adı
 * @param bolumler Her biri bir rehber (birden fazlaysa dizin + sayfa sonu)
 * @param tarih   İndirme tarihi (metin olarak)
 */
export function rehberBelgesi(
  baslik: string,
  bolumler: { id: string; baslik: string; govde: string }[],
  tarih: string,
): string {
  const cokBolum = bolumler.length > 1;
  const dizin = cokBolum
    ? `<nav class="dizin"><h2>İçindekiler</h2><ol>${bolumler
        .map((b) => `<li><a href="#${b.id}">${kacir(b.baslik)}</a></li>`)
        .join("")}</ol></nav>`
    : "";
  const govde = bolumler
    .map(
      (b, k) =>
        `${k > 0 ? '<hr class="sayfa-sonu" />' : ""}<article id="${b.id}" class="kart"><div class="rehber">${b.govde}</div></article>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${kacir(baslik)} — En Yakın Halı Yıkama</title>
<style>
${BELGE_CSS}
${REHBER_ICERIK_CSS}
</style>
</head>
<body>
<header class="ust">
  <div class="marka">En Yakın Halı Yıkama · Komisyoncu Rehberi</div>
  <div class="not">${kacir(tarih)} tarihinde indirildi · yalnız komisyoncular içindir, dışarıya dağıtma</div>
</header>
<div class="sayfa">
${dizin}
${govde}
<p class="alt">enyakinhaliyikamaservisi.com · Bu dosya indirildiği andaki metni içerir;
güncel sürüm her zaman komisyoncu panelindeki <strong>Rehberler</strong> bölümündedir.</p>
</div>
</body>
</html>`;
}
