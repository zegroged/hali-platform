// Şoför sipariş aksiyonlarının PAYLAŞILAN çekirdeği — native app'in Bearer'lı
// REST uçları buradan çağırır. Web /sofor server action'larıyla AYNI kurallar:
// CAS (eşzamanlı panel iptali/reddini ezme yok), ZORUNLU alım/teslim fotoğrafı,
// aynı bildirim/SMS yan etkileri. Web actions.ts'e dokunmadan (risk yok) burada
// paralel tutulur; ileride actions.ts de buraya bağlanabilir.
import { prisma } from "@/lib/prisma";
import { bildirTeslimEdildi, bildirMusteriyeEposta } from "@/lib/orderNotify";
import { getAuthedUser } from "@/lib/auth";
import { saveOrderPhotoFile } from "@/lib/orderPhoto";
import { sendSms, trackingLink } from "@/lib/sms";
import { waSiparisYolda, waGonderVeKaydet } from "@/lib/whatsapp";
import { DRIVER_NEXT, ORDER_STATUS_META } from "@/lib/orderStatus";
import { getAppBaseUrl } from "@/lib/config";

/** Bearer (native) VEYA çerez ile giriş yapmış ŞOFÖRÜN driver.id'si; yoksa null. */
export async function currentDriverId(): Promise<string | null> {
  const u = await getAuthedUser();
  if (!u || u.role !== "DRIVER") return null;
  const d = await prisma.driver.findUnique({
    where: { userId: u.id },
    select: { id: true },
  });
  return d?.id ?? null;
}

export type DriverActionResult =
  | { ok: true }
  | { ok: false; error: string; code?: number };

/** Şoförün aktif (kapanmamış) siparişleri — app listesi için. */
export async function listDriverOrders(driverId: string) {
  const orders = await prisma.order.findMany({
    where: {
      driverId,
      status: {
        in: ["CREATED", "ACCEPTED", "PICKED_UP", "WASHING", "OUT_FOR_DELIVERY"],
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      status: true,
      customerName: true,
      customerPhone: true,
      pickupAddress: true,
      pickupLat: true,
      pickupLng: true,
      approxM2: true,
      note: true,
      quotedPrice: true,
      priceApprovedAt: true,
      paymentMethod: true,
      createdAt: true,
    },
  });
  return orders.map((o) => ({
    ...o,
    quotedPrice: o.quotedPrice != null ? Number(o.quotedPrice) : null,
  }));
}

/** CREATED → ACCEPTED (CAS). */
export async function driverAccept(
  driverId: string,
  orderId: string,
): Promise<DriverActionResult> {
  const r = await prisma.order.updateMany({
    where: { id: orderId, driverId, status: "CREATED" },
    data: { status: "ACCEPTED" },
  });
  if (r.count === 0)
    return { ok: false, error: "Bu sipariş artık kabul edilemiyor.", code: 409 };
  await prisma.orderEvent.create({
    data: { orderId, status: "ACCEPTED", note: "Şoför kabul etti" },
  });
  return { ok: true };
}

/** CREATED → REJECTED (CAS) + müşteriye SMS. */
export async function driverReject(
  driverId: string,
  orderId: string,
  presetReason: string,
  note: string,
): Promise<DriverActionResult> {
  // Şoför red sebebi serbest metindir (web /sofor ile aynı) — boşsa "Belirtilmedi".
  const preset = presetReason.trim().slice(0, 120) || "Belirtilmedi";
  const reason = [preset, note.trim().slice(0, 300)].filter(Boolean).join(" — ");
  const o = await prisma.order.findFirst({
    where: { id: orderId, driverId, status: "CREATED" },
    select: { customerPhone: true },
  });
  if (!o) return { ok: false, error: "Bu sipariş reddedilemiyor.", code: 409 };
  const r = await prisma.order.updateMany({
    where: { id: orderId, driverId, status: "CREATED" },
    data: { status: "REJECTED", rejectReason: reason },
  });
  if (r.count === 0)
    return { ok: false, error: "Bu sipariş reddedilemiyor.", code: 409 };
  await prisma.orderEvent.create({
    data: { orderId, status: "REJECTED", note: `Reddedildi: ${reason}` },
  });
  try {
    await sendSms(
      o.customerPhone,
      `Talebiniz maalesef karsilanamadi. Sebep: ${reason}. Baska halici secebilirsiniz: ${getAppBaseUrl()}/halicilar`,
    );
  } catch {
    /* SMS hatası akışı bozmaz */
  }
  return { ok: true };
}

/** ACCEPTED → PICKED_UP (CAS) + ZORUNLU alım fotoğrafı. */
export async function driverPickup(
  driverId: string,
  orderId: string,
  photo: unknown,
): Promise<DriverActionResult> {
  const o = await prisma.order.findFirst({
    where: { id: orderId, driverId, status: "ACCEPTED" },
    select: { businessId: true },
  });
  if (!o) return { ok: false, error: "Bu sipariş şu an alınamıyor.", code: 409 };
  // "ALIM": fotoğraf aşamaya bağlanır → müşteri takipte "Alım" etiketiyle görür.
  const photoUrl = await saveOrderPhotoFile(photo, o.businessId, orderId, "ALIM");
  if (!photoUrl)
    return {
      ok: false,
      error: "Halının fotoğrafı zorunlu (hasar/kayıp kanıtı).",
      code: 400,
    };
  const r = await prisma.order.updateMany({
    where: { id: orderId, driverId, status: "ACCEPTED" },
    data: { status: "PICKED_UP", pickupPhotoUrl: photoUrl },
  });
  if (r.count === 0)
    return { ok: false, error: "Bu sipariş şu an alınamıyor.", code: 409 };
  await prisma.orderEvent.create({
    data: { orderId, status: "PICKED_UP", note: "Halı alındı" },
  });
  return { ok: true };
}

/** PICKED_UP → WASHING → OUT_FOR_DELIVERY (CAS) + yan etkiler. */
export async function driverAdvance(
  driverId: string,
  orderId: string,
  verbalConsent: boolean,
): Promise<DriverActionResult> {
  const o = await prisma.order.findFirst({
    where: { id: orderId, driverId, status: { in: ["PICKED_UP", "WASHING"] } },
    select: {
      id: true,
      code: true,
      status: true,
      priceApprovedAt: true,
      customerPhone: true,
      customerName: true,
      trackingToken: true,
      // WhatsApp: mesajda işletme adı geçer, gitmezse sahibine zil çalar.
      business: { select: { name: true, ownerId: true } },
    },
  });
  if (!o) return { ok: false, error: "Bu adım şu an yapılamıyor.", code: 409 };
  const next = DRIVER_NEXT[o.status];
  if (!next) return { ok: false, error: "Sıradaki adım yok.", code: 409 };
  const r = await prisma.order.updateMany({
    where: { id: orderId, driverId, status: o.status },
    data: { status: next },
  });
  if (r.count === 0)
    return { ok: false, error: "Bu adım şu an yapılamıyor.", code: 409 };
  await prisma.orderEvent.create({
    data: { orderId, status: next, note: ORDER_STATUS_META[next].label },
  });
  // md.15/1-h ispat kaydı (onaysız yıkamaya geçiş)
  if (o.status === "PICKED_UP" && next === "WASHING" && !o.priceApprovedAt) {
    await prisma.orderEvent.create({
      data: {
        orderId,
        status: next,
        note: verbalConsent
          ? "İşletme beyanı: müşteriden sözlü fiyat/ifa onayı alındı"
          : "Dijital fiyat onayı alınmadan yıkamaya geçildi",
      },
    });
    await bildirMusteriyeEposta(orderId, "yolda");
  }
  if (next === "OUT_FOR_DELIVERY") {
    await prisma.driver.update({
      where: { id: driverId },
      data: { lastLat: null, lastLng: null },
    });
    try {
      await sendSms(
        o.customerPhone,
        `Haliniz yola cikti! Canli takip: ${trackingLink(o.trackingToken)}`,
      );
    } catch {
      /* SMS hatası akışı bozmaz */
    }
    // WhatsApp (2026-07-27 denetim bulgusu): bu bildirim yalnız web panelinde
    // vardı; şoför uygulaması/şoför webinden ilerletilen siparişte müşteriye
    // HİÇBİR ŞEY gitmiyordu (SMS mock). İKİZ kural: üç yolda da aynı.
    void waGonderVeKaydet({
      orderId: o.id,
      status: "OUT_FOR_DELIVERY",
      ownerUserId: o.business.ownerId,
      etiket: "Teslimat bilgisi",
      metin: "Halınız teslimata çıktı, şoförümüz yolda.",
      gonder: () =>
        waSiparisYolda(
          o.customerPhone,
          o.customerName,
          o.business.name,
          o.code ?? "",
          o.trackingToken,
        ),
    });
  }
  return { ok: true };
}

/** OUT_FOR_DELIVERY → DELIVERED (CAS) + ZORUNLU teslim fotoğrafı + tahsilat. */
export async function driverDeliver(
  driverId: string,
  orderId: string,
  price: number,
  photo: unknown,
  // TAHSİLAT BEYANI (2026-07-29) — MOBİL UYGULAMAYI KIRMAMAK İÇİN OPSİYONEL.
  //
  // Panelde ve web şoför ekranında "Ücreti tahsil ettim" kutusu var. Play'deki
  // uygulama (versionCode 3) bu alanı GÖNDERMİYOR ve gönderemez — mağaza
  // güncellemesi gerekir. Bu yüzden alan gelmediğinde BUGÜNKÜ davranış korunur
  // (nakit = tahsil edildi). Yeni uygulama sürümü alanı açıkça gönderecek;
  // o zamana kadar mobilden teslim edilen nakit sipariş "tahsil edildi" sayılır.
  //
  // ⚠️ Yeni sürüm çıkınca burası `collected === true` olarak SIKILAŞTIRILMALI,
  // yoksa eski uygulamalar sessizce eski davranışta kalır (bkz. DEVIR).
  collected?: boolean,
  // "IBAN" gelirse para bankaya gecmis demektir (soforde nakit birakmaz).
  yontem?: string,
): Promise<DriverActionResult> {
  if (!Number.isFinite(price) || price <= 0)
    return { ok: false, error: "Geçerli bir teslim tutarı gir (0'dan büyük).", code: 400 };
  const o = await prisma.order.findFirst({
    where: { id: orderId, driverId, status: "OUT_FOR_DELIVERY" },
    select: {
      businessId: true,
      paymentMethod: true,
      paymentStatus: true,
      driver: { select: { userId: true } },
    },
  });
  if (!o) return { ok: false, error: "Bu sipariş şu an teslim edilemiyor.", code: 409 };
  const driverUserId = o.driver?.userId ?? null;
  const deliveryPhotoUrl = await saveOrderPhotoFile(
    photo,
    o.businessId,
    orderId,
    "TESLIM",
  );
  if (!deliveryPhotoUrl)
    return {
      ok: false,
      error: "Teslim fotoğrafı zorunlu (teslim + hasar kanıtı).",
      code: 400,
    };
  const isCash = o.paymentMethod === "CASH";
  // collected verilmemişse (eski uygulama) nakit teslim = tahsil edildi.
  const tahsilEdildi = isCash && collected !== false;
  const r = await prisma.order.updateMany({
    where: { id: orderId, status: "OUT_FOR_DELIVERY" },
    data: {
      status: "DELIVERED",
      priceTotal: price,
      deliveredAt: new Date(),
      deliveryPhotoUrl,
      commission: isCash ? 0 : undefined,
      paymentStatus: tahsilEdildi ? "PAID" : o.paymentStatus,
      collectedAmount: tahsilEdildi ? price : undefined,
      collectedAt: tahsilEdildi ? new Date() : undefined,
      collectedById: tahsilEdildi ? driverUserId : undefined,
      collectedMethod: tahsilEdildi ? (yontem === "IBAN" ? "IBAN" : "CASH") : undefined,
    },
  });
  if (r.count === 0)
    return { ok: false, error: "Bu sipariş şu an teslim edilemiyor.", code: 409 };
  const note = isCash
    ? `Teslim edildi · ${price} TL nakit tahsil edildi`
    : `Teslim edildi · ${price} TL (kartla ödeme bekleniyor)`;
  await prisma.orderEvent.create({
    data: { orderId, status: "DELIVERED", note },
  });
  await bildirTeslimEdildi(orderId);
  return { ok: true };
}
