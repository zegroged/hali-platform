"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendSms, trackingLink } from "@/lib/sms";
import { getAppBaseUrl } from "@/lib/config";
import { DRIVER_NEXT } from "@/lib/orderStatus";
import { saveOrderPhotoFile } from "@/lib/orderPhoto";
import { ORDER_STATUS_META } from "@/lib/orderStatus";

async function currentDriver() {
  const u = await getSessionUser();
  if (!u || u.role !== "DRIVER") redirect("/giris");
  const d = await prisma.driver.findUnique({ where: { userId: u.id } });
  if (!d) redirect("/giris");
  return d;
}

export async function acceptOrder(formData: FormData) {
  const d = await currentDriver();
  const id = String(formData.get("orderId"));
  // CAS (denetim bulgusu): findFirst→update({where:id}) koşulsuz yazıyordu;
  // tam o sırada işletme panelden reddederse (CREATED→REJECTED) şoförün isteği
  // REJECTED'i ACCEPTED'e ezip reddedilen siparişi diriltiyordu. updateMany yalnız
  // hâlâ CREATED + bu şoföre atanmışsa yazar; count 0 ise yarışı kaybettik → çık.
  const accepted = await prisma.order.updateMany({
    where: { id, driverId: d.id, status: "CREATED" },
    data: { status: "ACCEPTED" },
  });
  if (accepted.count === 0) return;
  await prisma.orderEvent.create({
    data: { orderId: id, status: "ACCEPTED", note: "Şoför kabul etti" },
  });
  revalidatePath("/sofor");
}

export async function rejectOrder(formData: FormData) {
  const d = await currentDriver();
  const id = String(formData.get("orderId"));
  const preset = String(formData.get("reason") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const reason = [preset || "Belirtilmedi", note].filter(Boolean).join(" — ");
  const o = await prisma.order.findFirst({
    where: { id, driverId: d.id, status: "CREATED" },
  });
  if (!o) return;
  // CAS (denetim bulgusu — kardeş fix): koşulsuz yazım, tam o sırada işletme
  // panelden KABUL ederse (CREATED→ACCEPTED) şoförün reddi ACCEPTED'i REJECTED'e
  // ezip devam eden siparişi yanlışlıkla kapatıp müşteriye "karşılanamadı" SMS'i
  // atıyordu. Yalnız hâlâ CREATED ise reddet; count 0 ise yarışı kaybettik → çık.
  const rejected = await prisma.order.updateMany({
    where: { id, driverId: d.id, status: "CREATED" },
    data: { status: "REJECTED", rejectReason: reason },
  });
  if (rejected.count === 0) return;
  await prisma.orderEvent.create({
    data: { orderId: id, status: "REJECTED", note: `Reddedildi: ${reason}` },
  });
  // SMS başarısızlığı iş akışını bozmasın (DB güncellemesi zaten yapıldı).
  try {
    await sendSms(
      o.customerPhone,
      `Talebiniz maalesef karşılanamadı. Sebep: ${reason}. Başka halıcı seçebilirsiniz: ${getAppBaseUrl()}/halicilar`,
    );
  } catch (e) {
    console.error("rejectOrder SMS hatası:", e);
  }
  revalidatePath("/sofor");
}

// Halıyı alırken para alınmaz; sadece fotoğraf/kayıt. Tahsilat teslimde.
export async function savePickup(formData: FormData) {
  const d = await currentDriver();
  const id = String(formData.get("orderId"));
  const o = await prisma.order.findFirst({
    where: { id, driverId: d.id, status: "ACCEPTED" },
  });
  if (!o) return;

  // ALIM (öncesi) FOTOĞRAFI ZORUNLU: halının işletmeye teslim edildiği andaki
  // durumunun kanıtı — hasar/kayıp uyuşmazlığında "Fotoğraflı Güvence"nin
  // temeli. Arayüz required; sunucuda da zorunlu (arayüz atlatılabilir).
  const photoUrl = await saveOrderPhotoFile(
    formData.get("photo"),
    o.businessId,
    o.id,
  );
  // Arayüz (PhotoForm) fotoğrafsız göndermeyi zaten alanın altında net uyarıyla
  // engelliyor. Atlatılırsa TAM-EKRAN hata yerine sessizce /sofor'a dön —
  // fotoğraf olmadan halı PICKED_UP olmaz.
  if (!photoUrl) redirect("/sofor");

  // CAS (denetim bulgusu): koşulsuz yazım, eşzamanlı panel iptali/reddini
  // (ACCEPTED→CANCELED/REJECTED) ezip siparişi PICKED_UP'a diriltiyordu.
  const picked = await prisma.order.updateMany({
    where: { id, driverId: d.id, status: "ACCEPTED" },
    data: { status: "PICKED_UP", pickupPhotoUrl: photoUrl },
  });
  if (picked.count === 0) return; // yarış: durum değişti → yazma, yan etki yok
  await prisma.orderEvent.create({
    data: { orderId: id, status: "PICKED_UP", note: "Halı alındı" },
  });
  revalidatePath("/sofor");
}

// Ara adımlar: alındı -> yıkanıyor -> yola çıktı. Teslim/tahsilat ayrı (deliverOrder).
export async function advanceOrder(formData: FormData) {
  const d = await currentDriver();
  const id = String(formData.get("orderId"));
  const o = await prisma.order.findFirst({
    where: { id, driverId: d.id, status: { in: ["PICKED_UP", "WASHING"] } },
  });
  if (!o) return;
  const next = DRIVER_NEXT[o.status];
  if (!next) return;

  // CAS (denetim bulgusu): koşulsuz yazım, tam o sırada işletme panelden iptal
  // ederse (PICKED_UP/WASHING→CANCELED) müşteriye "iptal/ücretsiz" denmiş
  // siparişi WASHING'e diriltip teslim+tahsilata götürüyordu. Yalnız hâlâ o.status
  // ise ilerlet; count 0 ise durum değişmiş → TÜM yan etkileri (SMS/konum) atla.
  const advanced = await prisma.order.updateMany({
    where: { id, driverId: d.id, status: o.status },
    data: { status: next },
  });
  if (advanced.count === 0) return;
  await prisma.orderEvent.create({
    data: { orderId: id, status: next, note: ORDER_STATUS_META[next].label },
  });

  // md.15/1-h ispat kaydı: müşterinin dijital fiyat onayı yokken yıkamaya
  // geçiliyorsa bu, zaman damgalı olarak kayda düşer (şoför akışı bloklanmaz;
  // işletme sözlü onayı panelden beyan edebilir).
  if (o.status === "PICKED_UP" && next === "WASHING" && !o.priceApprovedAt) {
    const verbalConsent = formData.get("verbalConsent") != null;
    await prisma.orderEvent.create({
      data: {
        orderId: id,
        status: next,
        note: verbalConsent
          ? "İşletme beyanı: müşteriden sözlü fiyat/ifa onayı alındı"
          : "Dijital fiyat onayı alınmadan yıkamaya geçildi",
      },
    });
  }

  if (next === "OUT_FOR_DELIVERY") {
    // B9: önceki teslimatın konumu sızmasın — sonraki ping'e kadar konumu temizle.
    await prisma.driver.update({
      where: { id: d.id },
      data: { lastLat: null, lastLng: null },
    });
    // B8: yüksek değerli tek bildirim — müşteri artık canlı takip edebilir (ASCII = 1 SMS).
    try {
      await sendSms(
        o.customerPhone,
        `Haliniz yola cikti! Canli takip: ${trackingLink(o.trackingToken)}`,
      );
    } catch (e) {
      console.error("advanceOrder SMS hatası:", e);
    }
  }
  revalidatePath("/sofor");
}

// Teslim anında tahsilat — Türk usulü: önce iş görülür, sonra ödeme alınır.
// NAKİT: teslimde tahsil → PAID. KART: tutar belirlenir, müşteri iyzico ile öder
// (init→callback PAID yapar); burada kart ÇEKİLMEZ (server-side kart çekimi yok).
export async function deliverOrder(formData: FormData) {
  const d = await currentDriver();
  const id = String(formData.get("orderId"));
  const price = Number(formData.get("price"));

  // Geçersiz/sıfır/negatif tutar sessizce yutulmasın → şoför net hata görsün.
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Geçerli bir teslim tutarı girin (0'dan büyük).");
  }

  const o = await prisma.order.findFirst({
    where: { id, driverId: d.id, status: "OUT_FOR_DELIVERY" },
  });
  if (!o) return;

  // TESLİM (sonrası) FOTOĞRAFI ZORUNLU: teslim kanıtı + halının iade anındaki
  // durumu. CAS'ten ÖNCE al ki foto yoksa sipariş DELIVERED işaretlenip para
  // kaydı açılmasın (yoksa foto-suz "teslim edildi" kalırdı). Arayüz required;
  // sunucuda da zorunlu.
  const deliveryPhotoUrl = await saveOrderPhotoFile(
    formData.get("photo"),
    o.businessId,
    id,
  );
  // Arayüz zaten engelliyor; atlatılırsa tam-ekran hata yerine sessizce dön —
  // fotoğraf olmadan DELIVERED olmaz / para kaydı açılmaz.
  if (!deliveryPhotoUrl) redirect("/sofor");

  const isCash = o.paymentMethod === "CASH";
  // Nakitte teslimde tahsil edilir; kartta ödeme iyzico callback'ine bırakılır.
  const paymentStatus = isCash ? "PAID" : o.paymentStatus;

  // CAS: yalnız hâlâ OUT_FOR_DELIVERY ise güncelle → çift tık / çift teslim engeli.
  const updated = await prisma.order.updateMany({
    where: { id, status: "OUT_FOR_DELIVERY" },
    data: {
      status: "DELIVERED",
      priceTotal: price,
      deliveryPhotoUrl,
      // Komisyon yalnız tahsilat gerçekleşince yazılır: nakit→şimdi (0),
      // kart→callback'te PAID ile birlikte (B6, çift-yazım yok).
      commission: isCash ? 0 : undefined,
      paymentStatus,
    },
  });
  if (updated.count === 0) return; // başka istek önce teslim etti

  const note =
    o.paymentMethod === "CASH"
      ? `Teslim edildi · ${price} TL nakit tahsil edildi`
      : `Teslim edildi · ${price} TL (kartla ödeme bekleniyor)`;
  await prisma.orderEvent.create({
    data: { orderId: id, status: "DELIVERED", note },
  });
  revalidatePath("/sofor");
}
