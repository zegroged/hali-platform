import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Next, public/ dosya listesini sunucu AÇILIŞINDA çıkarır; çalışırken yüklenen
// fotoğraflar (public/uploads/...) restart'a kadar 404 kalır. Bu route, statik
// eşleşme bulunamayınca devreye girer ve dosyayı diskten CANLI okur — yeni
// yüklenen fotoğraf anında servis edilir. (Açılışta bilinen dosyaları Next'in
// statik sunucusu karşılamaya devam eder; buraya hiç düşmezler.)

const MIME: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
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
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        // Dosya adları benzersiz (timestamp+rastgele) → güvenle kalıcı önbellek.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
