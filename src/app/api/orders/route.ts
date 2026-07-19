import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth";
import { sendSms, sendTrackingSms } from "@/lib/sms";
import { createOrderWithCode } from "@/lib/ordercode";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { subscriptionActive } from "@/lib/subscription";
import { getAppBaseUrl } from "@/lib/config";
import { notify } from "@/lib/notify";
import { CONTRACT_VERSION } from "@/lib/legal";
import { normalizeAddress } from "@/lib/text";

const Body = z.object({
  businessId: z.string().min(1).max(40),
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().min(10).max(20),
  // ZORUNLU: takip kodu/linki e-postayla gider (SMS ertelendi — misafirin
  // linki kaybetmemesi + md.9 kalıcı-ortam teyidinin garantili kanalı).
  customerEmail: z.string().trim().email().max(120),
  pickupAddress: z.string().min(5).max(300),
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  approxM2: z.number().positive().max(100000).optional(),
  note: z.string().max(500).optional(),
  paymentMethod: z.enum(["CASH", "CARD"]),
  // Mesafeli Sözleşmeler Yönetmeliği md.7: ön bilgilendirme teyidi olmadan
  // sözleşme kurulmuş sayılmaz → onay kutusu işaretlenmeden sipariş alınmaz.
  consent: z.literal(true, {
    message: "Ön bilgilendirme ve sözleşme onayı olmadan sipariş oluşturulamaz.",
  }),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }
  const d = parsed.data;

  // SMS bombing / spam koruması: kimlik doğrulamasız uç → IP + telefon limiti.
  const ip = clientIp(req);
  const ipRl = rateLimit(`order:ip:${ip}`, 8, 60 * 60 * 1000); // 8/saat
  if (!ipRl.ok) return tooMany(ipRl.retryAfterSec);
  const phoneRl = rateLimit(`order:phone:${d.customerPhone}`, 5, 24 * 60 * 60 * 1000); // 5/gün
  if (!phoneRl.ok) return tooMany(phoneRl.retryAfterSec);

  const business = await prisma.cleanerBusiness.findFirst({
    where: {
      id: d.businessId,
      isVisible: true,
      verification: { not: "REJECTED" },
    },
    select: {
      id: true,
      phone: true,
      ownerId: true,
      pausedUntil: true,
      subscription: { select: { status: true, currentPeriodEnd: true } },
    },
  });
  if (!business) {
    return NextResponse.json({ error: "Halıcı bulunamadı" }, { status: 404 });
  }
  // Aktif/geçerli-trial aboneliği olmayan halıcı sipariş ALAMAZ (gelir modeli).
  if (!subscriptionActive(business.subscription)) {
    return NextResponse.json(
      { error: "Bu halıcı şu anda sipariş almıyor." },
      { status: 410 },
    );
  }
  // Tatil modu: işletme siparişleri duraklattıysa kamu siparişi alınmaz
  // (profil yayında kalır; panelden manuel kayıt etkilenmez).
  if (business.pausedUntil && business.pausedUntil > new Date()) {
    return NextResponse.json(
      {
        error: `Bu işletme ${business.pausedUntil.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} tarihine kadar yeni sipariş almıyor. Başka bir halıcı seçebilirsin.`,
      },
      { status: 410 },
    );
  }

  const session = await getAuthedUser(); // çerez VEYA Bearer (native app)

  // Otomatik atama: işi halıcının kendi şoförüne düşür (mesaideki öncelikli)
  const driver = await prisma.driver.findFirst({
    where: { businessId: d.businessId },
    orderBy: [{ isOnShift: "desc" }, { createdAt: "asc" }],
    select: { id: true, userId: true, user: { select: { phone: true } } },
  });
  // Şoförü olmayan işletme sipariş alamaz → sipariş "CREATED"da asılı kalmasın (A5).
  if (!driver) {
    return NextResponse.json(
      { error: "Bu halıcının şu anda uygun şoförü yok, sipariş alınamıyor." },
      { status: 409 },
    );
  }

  // Adres BÜYÜK HARF düzeni — şoför/panel ekranlarında bağırmasın.
  const adres = normalizeAddress(d.pickupAddress);

  const order = await createOrderWithCode((code) =>
    prisma.order.create({
      data: {
        businessId: d.businessId,
        driverId: driver?.id,
        code,
        customerId: session?.role === "CUSTOMER" ? session.id : undefined,
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        customerEmail: d.customerEmail?.toLowerCase() ?? null,
        pickupAddress: adres,
        pickupLat: d.pickupLat,
        pickupLng: d.pickupLng,
        approxM2: d.approxM2,
        note: d.note,
        // Web'de şimdilik YALNIZ nakit (komisyon/kart ertelendi; app'te geri açılacak).
        paymentMethod: "CASH",
        // md.7 teyit kaydı: onay anı + o an yayında olan metin sürümü (ispat).
        consentAt: new Date(),
        contractVersion: CONTRACT_VERSION,
        events: { create: { status: "CREATED", note: "Talep oluşturuldu" } },
      },
    }),
  );

  // YENİ SİPARİŞ BİLDİRİMİ (kritik): işletme ve atanan şoför haberdar edilmezse
  // sipariş CREATED'da sessizce bekler. UYGULAMA-İÇİ bildirim asıl kanaldır
  // (SMS mock); SMS canlı olunca ikisi birden gider.
  const ref = order.code ?? order.trackingToken;
  await notify({
    userId: business.ownerId,
    type: "yeni-siparis",
    title: "Yeni sipariş geldi",
    body: `${d.customerName} · ${adres.slice(0, 50)}`,
    href: "/panel/siparisler",
  });
  if (driver.userId !== business.ownerId) {
    await notify({
      userId: driver.userId,
      type: "is-atandi",
      title: "Sana yeni iş atandı",
      body: `Kod: ${ref}`,
      href: "/sofor",
    });
  }
  try {
    await sendSms(
      business.phone,
      `Yeni siparis! Kod: ${ref} · ${d.customerName} · ${adres.slice(0, 60)}. Panel: ${getAppBaseUrl()}/panel/siparisler`,
    );
  } catch (e) {
    console.error("yeni sipariş işletme SMS hatası:", e);
  }
  if (driver.user.phone !== business.phone) {
    try {
      await sendSms(
        driver.user.phone,
        `Yeni is atandi! Kod: ${ref}. Detay ve kabul: ${getAppBaseUrl()}/sofor`,
      );
    } catch (e) {
      console.error("yeni sipariş şoför SMS hatası:", e);
    }
  }

  // Takip linki E-POSTA ile (SMS ertelendi; e-posta canlı ve bedava) —
  // md.9 teyidinin kalıcı-ortam bacağı. Best-effort: sipariş zaten kaydedildi.
  if (d.customerEmail) {
    try {
      const url = `${getAppBaseUrl()}/takip/${order.trackingToken}`;
      const kod = order.code ?? order.trackingToken;
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const { wrapEmail, sendEmail } = await import("@/lib/email");
      await sendEmail(
        d.customerEmail,
        `Siparişin alındı — takip kodun: ${kod}`,
        `Merhaba ${d.customerName}, halı yıkama talebin alındı. Takip kodun: ${kod}. Takip linki: ${url}`,
        wrapEmail(
          `<p style="margin:0 0 12px;">Merhaba ${esc(d.customerName)},</p>
           <p style="margin:0 0 12px;">Halı yıkama talebin alındı. Takip kodun:</p>
           <p style="margin:0 0 12px;font-size:26px;font-weight:bold;letter-spacing:3px;color:#0f766e;">${kod}</p>
           <p style="margin:0 0 16px;">Halının hangi aşamada olduğunu (alındı, yıkanıyor, yolda, teslim) aşağıdaki bağlantıdan anlık izleyebilirsin. Kesin fiyat, halın ölçüldükten sonra bu sayfada onayına sunulacak.</p>
           <p style="margin:0 0 16px;"><a href="${url}" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">Siparişimi takip et</a></p>
           <p style="margin:0;color:#64748b;font-size:13px;">Bu e-postayı sakla — takip bağlantın budur. Ödeme teslimde yapılır, ön ödeme yoktur.</p>`,
        ),
      );
    } catch (e) {
      console.error("takip e-postası hatası:", e);
    }
  }

  // SMS hatası sipariş oluşturmayı bozmasın (sipariş zaten kaydedildi).
  try {
    // Müşteriye giden takip linki UZUN trackingToken taşımalı (denetim bulgusu):
    // kesin-fiyat onayı/iptal yalnız bu özel linkle yapılır; kısa kod işletme+
    // şoförde görünür → onu link yapsaydık işletme müşteri onayını taklit ederdi.
    await sendTrackingSms(d.customerPhone, d.customerName, order.trackingToken);
  } catch (e) {
    console.error("order tracking SMS hatası:", e);
    // 6563 Yön. md.9: teyidin "ayrıca" bacağı (SMS) düştü — işletme panelinde
    // görünür iz bırak ki müşteri telefonla bilgilendirilsin. Event yazımı da
    // başarısız olursa yanıtı bozma (sipariş oluştu, müşteri takipte).
    try {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          status: "CREATED",
          note: "Teyit SMS gönderilemedi — müşteriyi telefonla bilgilendirin",
        },
      });
    } catch (evErr) {
      console.error("teyit SMS uyarı kaydı yazılamadı:", evErr);
    }
  }

  return NextResponse.json({
    trackingToken: order.trackingToken,
    code: order.code,
  });
}
