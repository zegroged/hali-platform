import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
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

export async function GET(
  _req: NextRequest,
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

  try {
    const buf = await readFile(full);
    // APK tarayıcıda açılmaya çalışılmasın, DOSYA olarak insin ve doğru adla
    // kaydedilsin (Android "bilinmeyen dosya" demesin).
    const indir: Record<string, string> =
      mime === "application/vnd.android.package-archive"
        ? { "Content-Disposition": `attachment; filename="${path.basename(full)}"` }
        : {};
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        ...indir,
        "Content-Type": mime,
        // Tarayıcı türü KENDİ TAHMİN ETMESİN: yukarıdaki beyaz liste ancak
        // sniffing kapalıyken gerçek bir kapıdır.
        "X-Content-Type-Options": "nosniff",
        // Dosya adları benzersiz (timestamp+rastgele) → güvenle kalıcı önbellek.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
