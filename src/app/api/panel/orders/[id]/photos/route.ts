import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { saveObject } from "@/lib/storage";

const MAX = 5 * 1024 * 1024; // 5 MB
const MAX_EDGE = 2560;
const WEBP_QUALITY = 90;
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
    const out = await sharp(buf, { limitInputPixels: 50_000_000 })
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

  // HALI NUMARASI (2026-08-02): panelden yüklenen her fotoğraf BİR HALI sayılır
  // ve sipariş içinde 1'den başlayarak numaralanır. Depoda "bu kimin halısı"
  // sorusu /panel/halilar ekranında bu numara + fotoğraf + müşteri adıyla
  // cevaplanıyor. Şoförün alım/teslim kanıt fotoğrafları numaralanmaz.
  const sonNo = await prisma.orderPhoto.aggregate({
    where: { orderId: order.id },
    _max: { carpetNo: true },
  });
  let siradakiNo = (sonNo._max.carpetNo ?? 0) + 1;

  const form = await req.formData();
  // AŞAMA (2026-07-30): panelden YALNIZ "YIKAMA" etiketlenebilir. Alım/teslim
  // fotoğrafı şoför akışında zorunlu çekilen KANIT'tır; panelden o etiketin
  // uydurulabilmesi kanıt zincirini değersizleştirirdi. Tanınmayan değer → null.
  const stage = form.get("stage") === "YIKAMA" ? "YIKAMA" : null;
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

  // Oluşturulan fotoğrafları geri döndür ki istemci sayfayı KOMPLE yenilemeden
  // (router.refresh — ağır yeniden-render) galeriye anında ekleyebilsin.
  const created: {
    id: string;
    url: string;
    stage: string | null;
    createdAt: Date;
  }[] = [];
  for (const file of files) {
    const rawExt = ALLOWED[file.type];
    if (!rawExt || file.size > MAX) continue;
    // Her dosya kendi try/catch'inde: disk/S3 hatası döngüyü kesip başarılıları
    // kaybetmesin ve 500'e düşmesin (denetim bulgusu) — hatalıyı atla.
    try {
      const original = Buffer.from(await file.arrayBuffer());
      const img = await optimizeImage(original, rawExt, file.type);
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${img.ext}`;
      const url = await saveObject(
        `uploads/${b.id}/orders/${order.id}/${name}`,
        img.buf,
        img.contentType,
      );
      const row = await prisma.orderPhoto.create({
        data: { orderId: order.id, url, stage, carpetNo: siradakiNo++ },
        select: {
          id: true,
          url: true,
          stage: true,
          carpetNo: true,
          createdAt: true,
        },
      });
      created.push(row);
    } catch (e) {
      console.error("sipariş fotoğrafı kaydedilemedi:", e);
    }
  }

  if (created.length === 0) {
    return NextResponse.json(
      { error: "Fotoğraf kaydedilemedi, tekrar dene." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    count: created.length,
    failed: files.length - created.length,
    photos: created,
  });
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
  const foto = await prisma.orderPhoto.findFirst({
    where: { id: photoId, order: { id, businessId: b.id } },
    select: {
      id: true,
      url: true,
      stage: true,
      order: { select: { pickupPhotoUrl: true, deliveryPhotoUrl: true } },
    },
  });
  if (!foto) return NextResponse.json({ ok: false }, { status: 404 });

  // ⚠️ KANIT FOTOĞRAFI SİLİNEMEZ (2026-07-28 denetim — YÜKSEK).
  //
  // Alım ve teslim fotoğrafı müşteriye verilmiş bir SÖZÜN dayanağı
  // ("Fotoğraflı Güvence") ve hasar tartışmasında iki tarafı da koruyan tek
  // kanıt. Bu uç hepsini ayrım yapmadan siliyordu: halı hasarlı geldiğinde
  // işletme alım fotoğrafını silip "bizde böyle değildi" diyebilirdi.
  // Fazladan çekilmiş diğer fotoğraflar silinebilir; kanıt olanlar duruyor.
  // Aşama etiketi de kanıt ölçütü: "ALIM"/"TESLIM" yalnız şoför akışında
  // yazılıyor (panelden yazılamaz), dolayısıyla url eşleşmesi kaçırsa bile
  // (ör. aynı siparişte ikinci bir alım karesi) korumaya takılır.
  const kanit =
    foto.stage === "ALIM" ||
    foto.stage === "TESLIM" ||
    foto.url === foto.order.pickupPhotoUrl ||
    foto.url === foto.order.deliveryPhotoUrl;
  if (kanit) {
    return NextResponse.json(
      {
        error:
          "Alım/teslim kanıt fotoğrafı silinemez — hasar tartışmasında hem seni hem müşteriyi koruyan kayıt budur.",
      },
      { status: 409 },
    );
  }

  const deleted = await prisma.orderPhoto.deleteMany({
    where: { id: photoId, order: { id, businessId: b.id } },
  });
  return NextResponse.json({ ok: deleted.count > 0 });
}
