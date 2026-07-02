import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness, syncVisibility } from "@/lib/panel";
import { saveObject } from "@/lib/storage";

const MAX = 5 * 1024 * 1024; // 5 MB
const MAX_EDGE = 1600; // uzun kenar üst sınırı (px)
const WEBP_QUALITY = 82;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Görseli kaydetmeden önce küçült + WebP'ye çevir (kart raylarında orijinal
// 5MB dosyalar inmesin). Sharp hata verirse orijinal dosyaya geri düşülür.
async function optimizeImage(
  buf: Buffer,
  ext: string,
  contentType: string,
): Promise<{ buf: Buffer; ext: string; contentType: string }> {
  try {
    const out = await sharp(buf)
      .rotate() // EXIF yönünü uygula (telefon fotoğrafları yan gelmesin)
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    return { buf: out, ext: "webp", contentType: "image/webp" };
  } catch {
    return { buf, ext, contentType };
  }
}

// Çoklu fotoğraf yükleme. AWS_S3_BUCKET varsa S3'e, yoksa yerel diske (saveObject seçer).
export async function POST(req: NextRequest) {
  const b = await getCurrentBusiness();
  if (!b) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const form = await req.formData();
  const kind = String(form.get("kind") || "after");
  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File)
    .slice(0, 10); // tek istekte en fazla 10 dosya (DoS/şişme koruması)
  if (!files.length) {
    return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
  }

  let count = 0;
  for (const file of files) {
    const rawExt = ALLOWED[file.type];
    if (!rawExt || file.size > MAX) continue;
    const original = Buffer.from(await file.arrayBuffer());
    const img = await optimizeImage(original, rawExt, file.type);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${img.ext}`;
    const url = await saveObject(`uploads/${b.id}/${name}`, img.buf, img.contentType);
    await prisma.businessPhoto.create({
      data: {
        businessId: b.id,
        url,
        isBefore: kind === "before",
        isAfter: kind === "after",
      },
    });
    count++;
  }

  if (count === 0) {
    return NextResponse.json(
      { error: "Geçerli görsel yok (jpg/png/webp, ≤5MB)" },
      { status: 400 },
    );
  }
  // Fotoğraf, profili tamamlayan son parça olabilir — görünürlüğü yeniden değerlendir
  // (addPhoto server action'ı bunu yapıyordu, dosya yükleme ucu atlıyordu).
  await syncVisibility(b.id);
  return NextResponse.json({ ok: true, count });
}
