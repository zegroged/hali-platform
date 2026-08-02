import {
  rehberBelgesi,
  rehberBul,
  rehberGovdesi,
  rehberleriListele,
} from "@/lib/rehberler";
import { komisyoncuKimligi } from "../../yetki";

export const dynamic = "force-dynamic";

// REHBER İNDİRME (2026-08-02) — kendi kendine yeten tek HTML dosyası.
//
// Neden HTML: kullanıcı isteği ("indirip görebilsin, html olarak açılsın").
// Dosya dış kaynak kullanmaz (CSS gömülü, yazı tipi sistemden) → telefonda
// internet olmadan da açılır, tarayıcıdan yazdırılabilir.
//
// slug === "tumu" → rolün gördüğü TÜM rehberler içindekiler listesiyle tek
// dosyada. Yetki süzgeci burada da rehberleriListele/rehberBul üzerinden
// çalışır: alt komisyoncu "tumu" indirse bile BAŞ rehberi dosyaya girmez.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const kimlik = await komisyoncuKimligi();
  if (!kimlik) return new Response("Yetkisiz", { status: 401 });

  const { slug } = await ctx.params;
  const tarih = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  });

  let baslik: string;
  let dosyaAdi: string;
  let bolumler: { id: string; baslik: string; govde: string }[];

  if (slug === "tumu") {
    const liste = rehberleriListele(kimlik.isHead);
    baslik = "Komisyoncu Rehberleri";
    dosyaAdi = "Komisyoncu-Rehberleri-Tumu";
    bolumler = liste.map((r) => ({
      id: `r-${r.slug}`,
      baslik: r.baslik,
      govde: rehberGovdesi(r),
    }));
  } else {
    const rehber = rehberBul(slug, kimlik.isHead);
    if (!rehber) return new Response("Bulunamadı", { status: 404 });
    baslik = rehber.baslik;
    dosyaAdi = rehber.dosyaAdi;
    bolumler = [
      {
        id: `r-${rehber.slug}`,
        baslik: rehber.baslik,
        govde: rehberGovdesi(rehber),
      },
    ];
  }

  return new Response(rehberBelgesi(baslik, bolumler, tarih), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // dosyaAdi bizim tablomuzdan gelir ve ASCII'dir — Türkçe karakterli
      // dosya adları bazı tarayıcılarda bozuk kaydediliyor.
      "Content-Disposition": `attachment; filename="${dosyaAdi}.html"`,
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
