// KÜÇÜK MARKDOWN ÇEVİRİCİSİ (2026-08-02)
//
// NEDEN KENDİ YAZDIK: yalnızca KENDİ yazdığımız rehber dosyalarını (repo
// kökündeki *.md) HTML'e çevirmek gerekti. Bunun için projeye marked/remark
// eklemek hem derleme süresini uzatır hem de sürekli güncelleme yükü getirir.
// Girdi KULLANICI VERİSİ DEĞİLDİR (derleme anında gömülür) — yine de her şey
// önce HTML kaçışından geçer ki bir gün başka yerde kullanılırsa güvenli olsun.
//
// DESTEKLENEN: başlık (# .. ######), yatay çizgi, alıntı (> — iç içe blok
// çözümlemesiyle), GFM tablo (hizalama dahil), sıralı/sırasız liste
// (sarmalanmış satırların devamı birleştirilir), paragraf, **kalın**,
// *italik*, `kod`, [metin](https://...).
// DESTEKLENMEYEN: iç içe liste, görsel, dipnot, ham HTML gömme.
//
// PARAGRAF KURALI: standart markdown gibi tek satır sonları BİRLEŞTİRİLİR
// (rehberlerde metin ~78 sütuna sarmalanmış — birleştirmezsek her satır
// kırılır). TEK İSTİSNA: satır `**Bir etiket:**` biçiminde başlıyorsa önüne
// <br> konur; "**Kısa:** ... / **Uzun:** ..." kalıbı tek bloba yapışmasın.
// Bu istisna bilerek dar tutuldu: `**kendiliğinden** oluşur` gibi sarmalanmış
// cümle başlarında iki nokta olmadığı için tetiklenmez.

function kacir(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Kaçırılmış metin üzerinde bağlantı → kalın → italik. */
function bicimle(kacirilmis: string): string {
  return kacirilmis
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_m, metin: string, adres: string) =>
        `<a href="${adres}" target="_blank" rel="noopener noreferrer">${metin}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

// Satır içi biçimlendirme. Metin ÖNCE backtick'e göre bölünür (yakalama
// gruplu split → tek indisler kod parçası): böylece kod içindeki * _ | gibi
// karakterler biçimlendirmeye takılmaz ve nöbetçi/placeholder hilesine
// gerek kalmaz.
function satirIci(ham: string): string {
  return ham
    .split(/`([^`]+)`/g)
    .map((parca, k) =>
      k % 2 === 1 ? `<code>${kacir(parca)}</code>` : bicimle(kacir(parca)),
    )
    .join("");
}

const RE_CIZGI = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const RE_BASLIK = /^(#{1,6})\s+(.*)$/;
const RE_ALINTI = /^\s*>/;
const RE_TABLO_SATIRI = /^\s*\|/;
const RE_TABLO_AYRAC = /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/;
const RE_SIRASIZ = /^\s*[-*+]\s+(.*)$/;
const RE_SIRALI = /^\s*(\d+)[.)]\s+(.*)$/;
const RE_ETIKET = /^\*\*[^*]*:\*\*/;

/** Bu satır yeni bir blok başlatıyor mu? (paragraf/liste devamını keser) */
function blokBasi(satir: string): boolean {
  return (
    RE_CIZGI.test(satir) ||
    RE_BASLIK.test(satir) ||
    RE_ALINTI.test(satir) ||
    RE_TABLO_SATIRI.test(satir)
  );
}

function listeBasi(satir: string): boolean {
  return !RE_CIZGI.test(satir) && (RE_SIRASIZ.test(satir) || RE_SIRALI.test(satir));
}

function hucreler(satir: string): string[] {
  return satir
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((h) => h.trim());
}

function bloklar(satirlar: string[]): string {
  const cikti: string[] = [];
  let i = 0;

  while (i < satirlar.length) {
    const s = satirlar[i];

    if (!s.trim()) {
      i++;
      continue;
    }

    if (RE_CIZGI.test(s)) {
      cikti.push("<hr />");
      i++;
      continue;
    }

    const baslik = RE_BASLIK.exec(s);
    if (baslik) {
      const n = baslik[1].length;
      cikti.push(`<h${n}>${satirIci(baslik[2].trim())}</h${n}>`);
      i++;
      continue;
    }

    // ALINTI: ardışık "> " satırlarını topla, önekini soy, İÇİNİ yeniden
    // çözümle — alıntı içinde tablo/liste/başlık olabiliyor (Pazarlamacı El
    // Kitabı §3.1'deki bildirim tablosu alıntının içindedir).
    if (RE_ALINTI.test(s)) {
      const ic: string[] = [];
      while (i < satirlar.length && RE_ALINTI.test(satirlar[i])) {
        ic.push(satirlar[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      cikti.push(`<blockquote>${bloklar(ic)}</blockquote>`);
      continue;
    }

    // TABLO: "|" ile başlayan satır + hemen ardından ayraç satırı
    if (
      RE_TABLO_SATIRI.test(s) &&
      i + 1 < satirlar.length &&
      RE_TABLO_AYRAC.test(satirlar[i + 1])
    ) {
      const basliklar = hucreler(s);
      const hiza = hucreler(satirlar[i + 1]).map((a) =>
        a.startsWith(":") && a.endsWith(":")
          ? "center"
          : a.endsWith(":")
            ? "right"
            : "left",
      );
      i += 2;
      const govde: string[][] = [];
      while (i < satirlar.length && RE_TABLO_SATIRI.test(satirlar[i])) {
        govde.push(hucreler(satirlar[i]));
        i++;
      }
      const bas = basliklar
        .map((h, k) => `<th style="text-align:${hiza[k] ?? "left"}">${satirIci(h)}</th>`)
        .join("");
      const alt = govde
        .map(
          (r) =>
            `<tr>${r
              .map(
                (c, k) =>
                  `<td style="text-align:${hiza[k] ?? "left"}">${satirIci(c)}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("");
      cikti.push(
        `<div class="tablo-kutu"><table><thead><tr>${bas}</tr></thead><tbody>${alt}</tbody></table></div>`,
      );
      continue;
    }

    // LİSTE
    if (listeBasi(s)) {
      const siraliMi = RE_SIRALI.test(s) && !RE_SIRASIZ.test(s);
      const ilkNumara = siraliMi ? Number(RE_SIRALI.exec(s)![1]) : 1;
      const ogeler: string[] = [];
      while (i < satirlar.length) {
        const cur = satirlar[i];
        if (!cur.trim()) {
          // Boş satır listeyi bitirir — ardından yine liste geliyorsa değil.
          if (!listeBasi(satirlar[i + 1] ?? "")) break;
          i++;
          continue;
        }
        const m = siraliMi ? RE_SIRALI.exec(cur) : RE_SIRASIZ.exec(cur);
        if (m && !RE_CIZGI.test(cur)) {
          ogeler.push(siraliMi ? m[2] : m[1]);
          i++;
          continue;
        }
        // Sarmalanmış satırın devamı — ama yeni bir blok başlıyorsa DEĞİL
        // (aksi halde "---" yatay çizgisi son maddenin içine yapışırdı).
        if (ogeler.length && !blokBasi(cur) && !listeBasi(cur)) {
          ogeler[ogeler.length - 1] += " " + cur.trim();
          i++;
          continue;
        }
        break;
      }
      const govde = ogeler.map((o) => `<li>${satirIci(o)}</li>`).join("");
      cikti.push(
        siraliMi
          ? `<ol${ilkNumara !== 1 ? ` start="${ilkNumara}"` : ""}>${govde}</ol>`
          : `<ul>${govde}</ul>`,
      );
      continue;
    }

    // PARAGRAF — satırlar birleşir; "**Etiket:**" ile başlayanlar <br> alır.
    const gruplar: string[][] = [];
    while (
      i < satirlar.length &&
      satirlar[i].trim() &&
      !blokBasi(satirlar[i]) &&
      !listeBasi(satirlar[i])
    ) {
      const satir = satirlar[i].trim();
      if (gruplar.length === 0 || RE_ETIKET.test(satir)) gruplar.push([satir]);
      else gruplar[gruplar.length - 1].push(satir);
      i++;
    }
    if (gruplar.length === 0) {
      i++; // güvenlik ağı: hiçbir kural tutmadıysa sonsuz döngüye girme
      continue;
    }
    cikti.push(
      `<p>${gruplar.map((g) => satirIci(g.join(" "))).join("<br />")}</p>`,
    );
  }

  return cikti.join("\n");
}

/** Markdown metnini (bizim rehberlerimiz) HTML gövdesine çevirir. */
export function markdownHtml(md: string): string {
  return bloklar(md.replace(/\r\n?/g, "\n").split("\n"));
}
