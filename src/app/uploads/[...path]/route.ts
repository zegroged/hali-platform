import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

// Next, public/ dosya listesini sunucu AÇILIŞINDA çıkarır; çalışırken yüklenen
// fotoğraflar (public/uploads/...) restart'a kadar 404 kalır. Bu route, statik
// eşleşme bulunamayınca devreye girer ve dosyayı diskten CANLI okur — yeni
// yüklenen fotoğraf anında servis edilir. (Açılışta bilinen dosyaları Next'in
// statik sunucusu karşılamaya devam eder; buraya hiç düşmezler.)

// ⚠️ BU LİSTE BİR GÜVENLİK KAPISIDIR, kolaylık listesi değil: burada olmayan
// uzantı 404 döner. `svg` ve `html` BİLEREK YOK — kullanıcıdan gelen bir dosya
// kendi alan adımızda çalıştırılabilir içerik olursa XSS'e dönüşür.
// Ses/video/pdf 2026-08-07 akşam eklendi: müşterinin WhatsApp'tan gönderdiği
// sesli mesaj ve belgeler de panelde açılabilsin (bkz. lib/whatsappMedya.ts).
const MIME: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  amr: "audio/amr",
  mp4: "video/mp4",
  "3gp": "video/3gpp",
  pdf: "application/pdf",
  // APK (2026-08-07 akşam): işletme sahibi Expo'nun indirme linkinden APK'yı
  // indiremiyordu — "50 MB'da takılıyor". Sunucudan ölçüldü: dosya sağlam,
  // 3 saniyede tam iniyor (59,6 MB) → sorun Expo CDN'inin oraya giden yolunda.
  // Artık build'ler kendi alan adımızdan (Cloudflare arkasında) veriliyor.
  apk: "application/vnd.android.package-archive",
};

// Dosyayı RAM'e almadan akıtır. 62 MB'lık APK'yı `readFile` ile okumak hem
// istek başına 62 MB bellek demekti hem de yanıtın `Content-Length`siz
// (chunked) gitmesine yol açıyordu.
function akit(dosya: string, bas: number, son: number) {
  return Readable.toWeb(
    createReadStream(dosya, { start: bas, end: son }),
  ) as unknown as ReadableStream<Uint8Array>;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  const base = path.join(process.cwd(), "public", "uploads");
  const full = path.normalize(path.join(base, ...parts));

  // Path traversal koruması: çözümlenen yol uploads kökünün dışına çıkamaz.
  if (!full.startsWith(base + path.sep)) {
    return new NextResponse(null, { status: 404 });
  }
  const mime = MIME[path.extname(full).slice(1).toLowerCase()];
  if (!mime) return new NextResponse(null, { status: 404 });

  let boyut: number;
  try {
    const st = await stat(full);
    if (!st.isFile()) return new NextResponse(null, { status: 404 });
    boyut = st.size;
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  // APK tarayıcıda açılmaya çalışılmasın, DOSYA olarak insin ve doğru adla
  // kaydedilsin (Android "bilinmeyen dosya" demesin).
  const indir: Record<string, string> =
    mime === "application/vnd.android.package-archive"
      ? { "Content-Disposition": `attachment; filename="${path.basename(full)}"` }
      : {};
  const ortak: Record<string, string> = {
    ...indir,
    "Content-Type": mime,
    // Tarayıcı türü KENDİ TAHMİN ETMESİN: yukarıdaki beyaz liste ancak
    // sniffing kapalıyken gerçek bir kapıdır.
    "X-Content-Type-Options": "nosniff",
    // Dosya adları benzersiz (timestamp+rastgele) → güvenle kalıcı önbellek.
    "Cache-Control": "public, max-age=31536000, immutable",
    // 🔴 2026-08-08: işletme sahibi APK'yı indiremedi — %100'de takılıp
    // bitmiyordu. Sebep buydu: aralık desteği olmadığı için mobil hatta
    // yarıda kesilen 62 MB'lık indirme KALDIĞI YERDEN DEVAM EDEMİYOR,
    // her kopuş baştan başlamak demek. (Aynı semptom Expo linkinde de
    // yaşanmıştı — 4.72'de kaynağı değiştirdim ama indirmeyi
    // sağlamlaştırmadığım için geri geldi.)
    "Accept-Ranges": "bytes",
  };

  // Range: bytes=100-  ·  bytes=100-200  ·  bytes=-500 (sondan)
  const eslesme = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (eslesme && (eslesme[1] !== "" || eslesme[2] !== "")) {
    const kapsamDisi = () =>
      new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${boyut}` },
      });

    let bas: number;
    let son: number;
    if (eslesme[1] === "") {
      const sondan = Number(eslesme[2]);
      if (!sondan) return kapsamDisi();
      bas = Math.max(0, boyut - sondan);
      son = boyut - 1;
    } else {
      bas = Number(eslesme[1]);
      son = eslesme[2] === "" ? boyut - 1 : Math.min(Number(eslesme[2]), boyut - 1);
    }
    if (!Number.isFinite(bas) || !Number.isFinite(son) || bas > son || bas >= boyut) {
      return kapsamDisi();
    }

    return new NextResponse(akit(full, bas, son), {
      status: 206,
      headers: {
        ...ortak,
        "Content-Length": String(son - bas + 1),
        "Content-Range": `bytes ${bas}-${son}/${boyut}`,
      },
    });
  }

  return new NextResponse(akit(full, 0, boyut - 1), {
    headers: { ...ortak, "Content-Length": String(boyut) },
  });
}
