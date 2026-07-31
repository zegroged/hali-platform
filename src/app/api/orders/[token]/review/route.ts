import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { normalizePhone } from "@/lib/phone";

// Müşteri yorumu + yıldız. ARTIK ÜYELİK ZORUNLU: yalnız giriş yapmış müşteri
// (CUSTOMER) yorum yapabilir — takip linki o siparişe erişim kanıtı, üyelik ise
// kimlik + hesap verilebilirliği sağlar (sahte/anonim yorumu azaltır). Yalnız
// TESLİM EDİLMİŞ sipariş, sipariş başına 1 yorum. Yoruma ödül puanı verilir.
const REVIEW_POINTS = 50;
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

  // ÜYELİK ZORUNLU: yalnız giriş yapmış müşteri yorum yapabilir.
  const viewer = await getAuthedUser();
  if (!viewer || viewer.role !== "CUSTOMER") {
    return NextResponse.json(
      { error: "Değerlendirme yapmak için üye girişi gerekli." },
      { status: 401 },
    );
  }

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
    select: {
      id: true,
      code: true,
      status: true,
      businessId: true,
      customerId: true,
      isManual: true,
      business: {
        select: {
          ownerId: true,
          name: true,
          phone: true,
          gsmPhone2: true,
          landlinePhone: true,
          whatsappNumber: true,
          owner: { select: { email: true, phone: true } },
        },
      },
      review: { select: { id: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  // SAHİPLİK (denetim bulgusu): yorumu yalnız siparişin GERÇEK müşterisi
  // yazabilir. Aksi halde kodu bilen işletme sahibi ayrı bir CUSTOMER hesabı
  // açıp kendi işletmesine sipariş başına 1 sahte 5-yıldız enjekte edip
  // puanı/sıralamayı/rozeti şişirebiliyordu. Misafir sipariş (customerId null)
  // önce customer-register ile (OTP'li e-posta eşleşmesi) sahiplenilmeli.
  if (order.customerId == null || order.customerId !== viewer.id) {
    return NextResponse.json(
      {
        error:
          "Bu siparişi değerlendirme yetkiniz yok. Yalnız siparişi veren hesap değerlendirebilir.",
      },
      { status: 403 },
    );
  }
  // Öz-yorum koruması: işletme sahibi kendi işletmesini puanlayamaz.
  if (order.business?.ownerId === viewer.id) {
    return NextResponse.json(
      { error: "Kendi işletmenizi değerlendiremezsiniz." },
      { status: 403 },
    );
  }
  // ÖZ-YORUM 2. KATMAN (2026-07-31, 4.30'un açık maddesi): sahibin İKİNCİ bir
  // müşteri hesabıyla kendine yıldız basması. Kullanıcı kimliği farklı olsa da
  // TELEFON/E-POSTA işletmeninkiyle eşleşiyorsa reddedilir. Kalan boşluk
  // (üçüncü kişiye ait numarayla hesap) aşağıdaki şüpheli-örüntü zili ile
  // admin'e düşer — engellemek yerine görünür kılınır (yanlış pozitif riskine
  // karşı gerçek müşteri mağdur edilmez).
  const viewerKimlik = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: { email: true, phone: true, createdAt: true },
  });
  const tel = (v: string | null | undefined) => normalizePhone(v ?? "") || null;
  const viewerTel = tel(viewerKimlik?.phone);
  const isletmeTelleri = [
    order.business?.phone,
    order.business?.gsmPhone2,
    order.business?.landlinePhone,
    order.business?.whatsappNumber,
    order.business?.owner?.phone,
  ]
    .map(tel)
    .filter(Boolean);
  const viewerEposta = viewerKimlik?.email?.toLowerCase() ?? null;
  const sahipEposta = order.business?.owner?.email?.toLowerCase() ?? null;
  if (
    (viewerTel && isletmeTelleri.includes(viewerTel)) ||
    (viewerEposta && sahipEposta && viewerEposta === sahipEposta)
  ) {
    return NextResponse.json(
      { error: "Kendi işletmenizi değerlendiremezsiniz." },
      { status: 403 },
    );
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

  let awarded = 0;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          orderId: order.id,
          businessId: order.businessId,
          customerId: viewer.id, // üye kimliği (kim yazdı)
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
      // Ödül puanı — yorum unique kısıttan geçtiyse (aynı transaction) ver.
      await tx.user.update({
        where: { id: viewer.id },
        data: { points: { increment: REVIEW_POINTS } },
      });
      awarded = REVIEW_POINTS;
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

  // ŞÜPHELİ ÖRÜNTÜ ZİLİ (engel değil, görünürlük): iki işaret —
  //  (a) MANUEL kayda yüksek puan: manuel siparişi halıcı kendisi açar,
  //      müşteri telefonu serbest metindir; kendi kontrolündeki numarayla
  //      sahte akış kurmanın en kolay yolu budur.
  //  (b) Yorumdan < 48 saat önce açılmış hesaptan 5 yıldız: gerçek müşteri de
  //      olabilir (teslimden sonra üye olan) — o yüzden yalnız bildirim.
  // Best-effort: zil hatası yorumu bozmaz.
  try {
    const hesapYasiMs = viewerKimlik
      ? Date.now() - viewerKimlik.createdAt.getTime()
      : Infinity;
    const isaretler: string[] = [];
    if (order.isManual && rating >= 4) isaretler.push("manuel kayda yüksek puan");
    if (hesapYasiMs < 48 * 60 * 60 * 1000 && rating === 5)
      isaretler.push("48 saatten yeni hesaptan 5 yıldız");
    if (isaretler.length > 0) {
      const { notifyAdmins } = await import("@/lib/notify");
      await notifyAdmins({
        type: "genel",
        title: "Şüpheli yorum örüntüsü",
        body: `${order.business?.name ?? "İşletme"} — ${order.code ?? order.id}: ${rating}★ (${isaretler.join(" + ")}). Gerekirse admin panelden yorumu sil.`,
        href: `/admin/isletme/${order.businessId}`,
      });
    }
  } catch (e) {
    console.error("[yorum-suphe] zil hatası:", e);
  }

  return NextResponse.json({ ok: true, pointsAwarded: awarded });
}
