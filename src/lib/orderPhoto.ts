import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { saveObject } from "@/lib/storage";

const MAX = 8 * 1024 * 1024; // 8 MB (server action gövde limitiyle uyumlu)
const MAX_EDGE = 1600;
const WEBP_QUALITY = 82;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Şoför aksiyonlarından gelen sipariş fotoğrafı: doğrula → küçült/WebP →
 * kaydet → OrderPhoto satırı aç (müşteri takip sayfasında görür).
 * Geçersiz/boş dosyada null döner — fotoğraf opsiyonel, akışı bloklamaz.
 */
export async function saveOrderPhotoFile(
  file: unknown,
  businessId: string,
  orderId: string,
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!ALLOWED.has(file.type) || file.size > MAX) return null;

  const original = Buffer.from(await file.arrayBuffer());
  let buf = original;
  let contentType = file.type;
  let ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  try {
    buf = await sharp(original)
      .rotate() // EXIF yönü (telefon fotoğrafları yan gelmesin)
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    contentType = "image/webp";
    ext = "webp";
  } catch {
    // sharp hata verirse orijinal dosyaya düş
  }

  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const url = await saveObject(
    `uploads/${businessId}/orders/${orderId}/${name}`,
    buf,
    contentType,
  );
  await prisma.orderPhoto.create({ data: { orderId, url } });
  return url;
}
