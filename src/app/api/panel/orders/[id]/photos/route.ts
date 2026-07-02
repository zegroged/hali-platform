import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { saveObject } from "@/lib/storage";

const MAX = 5 * 1024 * 1024; // 5 MB
const MAX_EDGE = 1600;
const WEBP_QUALITY = 82;
const MAX_PER_ORDER = 20; // sipariş başına toplam fotoğraf sınırı
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// İşletme foto yükleme ucuyla aynı optimizasyon (küçült + WebP; hata → orijinal).
async function optimizeImage(
  buf: Buffer,
  ext: string,
  contentType: string,
): Promise<{ buf: Buffer; ext: string; contentType: string }> {
  try {
    const out = await sharp(buf)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    return { buf: out, ext: "webp", contentType: "image/webp" };
  } catch {
    return { buf, ext, contentType };
  }
}

// Halıcının siparişe fotoğraf eklemesi — müşteri takip sayfasında görür.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const b = await getCurrentBusiness();
  if (!b) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, businessId: b.id },
    select: { id: true, _count: { select: { photos: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

  const form = await req.formData();
  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File)
    .slice(0, Math.max(0, MAX_PER_ORDER - order._count.photos));
  if (!files.length) {
    return NextResponse.json(
      { error: "Dosya yok veya fotoğraf sınırına ulaşıldı (20)." },
      { status: 400 },
    );
  }

  let count = 0;
  for (const file of files) {
    const rawExt = ALLOWED[file.type];
    if (!rawExt || file.size > MAX) continue;
    const original = Buffer.from(await file.arrayBuffer());
    const img = await optimizeImage(original, rawExt, file.type);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${img.ext}`;
    const url = await saveObject(
      `uploads/${b.id}/orders/${order.id}/${name}`,
      img.buf,
      img.contentType,
    );
    await prisma.orderPhoto.create({ data: { orderId: order.id, url } });
    count++;
  }

  return NextResponse.json({ ok: true, count });
}

// Fotoğraf silme (yanlış yükleme düzeltilebilsin).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const b = await getCurrentBusiness();
  if (!b) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { id } = await params;
  const photoId = String(
    (await req.json().catch(() => ({})))?.photoId ?? "",
  );
  if (!photoId) {
    return NextResponse.json({ error: "photoId gerekli" }, { status: 400 });
  }
  // Sahiplik: foto → sipariş → bu işletme zinciri doğrulanır.
  const deleted = await prisma.orderPhoto.deleteMany({
    where: { id: photoId, order: { id, businessId: b.id } },
  });
  return NextResponse.json({ ok: deleted.count > 0 });
}
