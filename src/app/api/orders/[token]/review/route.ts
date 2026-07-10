import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

// Müşteri yorumu + yıldız (misafir; takip kodu kimlik yerine geçer).
// Yalnız TESLİM EDİLMİŞ sipariş değerlendirilebilir; sipariş başına 1 yorum
// (Review.orderId @unique). İşletmenin ratingAvg/ratingCount'u atomik güncellenir.
const Body = z.object({
  rating: z.number().int().min(1, "En az 1 yıldız").max(5, "En fazla 5 yıldız"),
  comment: z.string().trim().max(500, "Yorum en fazla 500 karakter").optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = clientIp(req);
  const rl = rateLimit(`order-review:${ip}`, 10, 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Geçersiz veri" },
      { status: 400 },
    );
  }
  const { rating } = parsed.data;
  const comment = parsed.data.comment || null;

  const { token } = await params;
  const order = await prisma.order.findFirst({
    where: { OR: [{ trackingToken: token }, { code: token.toUpperCase() }] },
    select: { id: true, status: true, businessId: true, review: { select: { id: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  if (order.status !== "DELIVERED") {
    return NextResponse.json(
      { error: "Değerlendirme yalnız teslim edilen siparişler için yapılabilir." },
      { status: 409 },
    );
  }
  if (order.review) {
    return NextResponse.json(
      { error: "Bu sipariş için zaten bir değerlendirme yapılmış." },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          orderId: order.id,
          businessId: order.businessId,
          rating,
          comment,
        },
      });
      // Denormalize puanı yorumlardan yeniden hesapla (yarışta bile tutarlı).
      const agg = await tx.review.aggregate({
        where: { businessId: order.businessId },
        _avg: { rating: true },
        _count: true,
      });
      await tx.cleanerBusiness.update({
        where: { id: order.businessId },
        data: {
          ratingAvg: agg._avg.rating ?? 0,
          ratingCount: agg._count,
        },
      });
    });
  } catch (e) {
    // Yarış: aynı anda ikinci istek unique kısıta takıldı → zaten yorumlanmış.
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Bu sipariş için zaten bir değerlendirme yapılmış." },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
