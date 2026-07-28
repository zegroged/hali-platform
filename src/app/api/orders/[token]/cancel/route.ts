// Platform üzerinden cayma/iptal bildirimi (Mesafeli Sözleşmeler Yönetmeliği
// md.11/5): tüketici cayma beyanını platform ÜZERİNDEN gönderir; bildirim
// zaman damgalı kayda geçer, işletmeye SMS ile derhal iletilir ve tüketiciye
// hem ekranda hem SMS ile teyit verilir.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bildirSiparisKesintisi } from "@/lib/orderNotify";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { sendSms } from "@/lib/sms";
import { getAuthedUser } from "@/lib/auth";

// İptal öncesi sorulan "neden" seçenekleri — istatistik + işletmeye bildirim.
// İstemcideki listeyle aynı tutulmalı (TrackingClient CANCEL_REASONS).
const CANCEL_REASONS = new Set([
  "Vazgeçtim",
  "Fiyat beklentimi aştı",
  "Başka işletmeyle anlaştım",
  "Zamanlama uygun değil",
  "Diğer",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Tek seferlik aksiyon — takip polling'inden ayrı, daha sıkı limit.
  const ip = clientIp(req);
  const rl = rateLimit(`order-cancel:${ip}`, 10, 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  // İptal anketi (opsiyonel gövde): neden listeden, not serbest metin.
  const body = (await req.json().catch(() => null)) as {
    reason?: unknown;
    note?: unknown;
  } | null;
  const reason =
    typeof body?.reason === "string" && CANCEL_REASONS.has(body.reason)
      ? body.reason
      : null;
  const note =
    typeof body?.note === "string" ? body.note.trim().slice(0, 300) : "";

  const { token } = await params;
  // Link (trackingToken) ya da kısa kod ile bulunabilir
  const order = await prisma.order.findFirst({
    where: { OR: [{ trackingToken: token }, { code: token.toUpperCase() }] },
    select: {
      id: true,
      code: true,
      trackingToken: true,
      customerId: true,
      status: true,
      customerPhone: true,
      priceApprovedAt: true,
      business: { select: { phone: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  // MÜŞTERİYE ÖZEL KANAL (denetim bulgusu): cayma/iptal geri dönüşsüz bir
  // müşteri aksiyonu → yalnız (a) müşteriye giden UZUN takip bağlantısı
  // (trackingToken) ile YA DA (b) siparişi veren üye girişiyle. Kısa kod
  // işletme+şoförde görünür / tahmin edilebilir; tek başına kabul etseydik
  // üçüncü taraf müşteri adına iptal edebilirdi.
  const viewer = await getAuthedUser();
  const isOwner =
    viewer?.role === "CUSTOMER" &&
    order.customerId != null &&
    order.customerId === viewer.id;
  if (order.trackingToken !== token && !isOwner) {
    return NextResponse.json(
      {
        error:
          "İptal/cayma bildirimi için size SMS/e-posta ile gönderilen takip bağlantısını açın (veya siparişi veren hesapla giriş yapın). Kısa takip kodu tek başına bu işlem için kullanılamaz.",
      },
      { status: 403 },
    );
  }

  // CAS: cayma/iptal YALNIZ halı teslim alınmadan (CREATED/ACCEPTED) kullanılabilir.
  // Halı alındığı an hizmet ifası başlar (taşıma dahil) → md.15/1-h istisnası;
  // bu aşamadan sonra müşterinin çıkışı kesin fiyat onayını REDDETMEKTİR
  // (halı yıkanmadan ücretsiz iade edilir — /iade §2).
  const canceled = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: { in: ["CREATED", "ACCEPTED"] },
      priceApprovedAt: null,
    },
    data: { status: "CANCELED" },
  });
  if (canceled.count === 0) {
    // Çift tık: zaten iptal edilmişse idempotent başarı döndür.
    if (order.status === "CANCELED") return NextResponse.json({ ok: true });
    const afterPickup = ["PICKED_UP", "WASHING", "OUT_FOR_DELIVERY"].includes(
      order.status,
    );
    return NextResponse.json(
      {
        error: afterPickup
          ? "Halınız teslim alındığı için cayma hakkı kullanılamaz (hizmet ifası başladı — Yönetmelik md.15/1-h). Kesin fiyat bildirildiğinde onaylamazsanız halınız yıkanmadan ücretsiz iade edilir; ayrıca işletmeyi arayabilirsiniz."
          : "Bu aşamada platform üzerinden iptal edilemiyor. Lütfen işletmeyi arayın.",
      },
      { status: 409 },
    );
  }

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      status: "CANCELED",
      note:
        "Müşteri platform üzerinden cayma/iptal bildirdi" +
        (reason ? ` — Neden: ${reason}` : "") +
        (note ? ` — Not: ${note}` : ""),
    },
  });

  // İŞLETME + ŞOFÖR ZİLİ (2026-07-28 denetim — KRİTİK): buraya kadar yalnız
  // SMS vardı, SMS ise MOCK. Şoför iptalden habersiz halıyı almaya gidiyordu.
  await bildirSiparisKesintisi({
    orderId: order.id,
    tur: "iptal",
    kaynak: "musteri",
    sebep: reason || null,
  });

  const ref = order.code ?? order.trackingToken;
  // SMS hataları iptali bozmasın (durum zaten yazıldı) — md.11/5'in "derhal
  // iletme + teyit" bacağı: işletmeye bildirim, müşteriye teyit.
  try {
    await sendSms(
      order.business.phone,
      `${ref} kodlu siparis musteri tarafindan iptal edildi.` +
        (reason ? ` Neden: ${reason}` : ""),
    );
  } catch (e) {
    console.error("cancel işletme SMS hatası:", e);
  }
  try {
    await sendSms(
      order.customerPhone,
      `Cayma/iptal bildiriminiz isletmeye iletildi. Siparis kodu: ${ref}`,
    );
  } catch (e) {
    console.error("cancel müşteri teyit SMS hatası:", e);
  }

  return NextResponse.json({ ok: true });
}
