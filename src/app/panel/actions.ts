"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness, profileComplete, syncVisibility } from "@/lib/panel";
import { hashPassword } from "@/lib/auth";
import { sendSms, trackingLink } from "@/lib/sms";
import { getAppBaseUrl } from "@/lib/config";
import { ORDER_STATUS_META, PANEL_NEXT } from "@/lib/orderStatus";
import { isValidTaxOrTckn } from "@/lib/taxId";
import type { PricingUnit } from "@prisma/client";

async function biz() {
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");
  return b;
}

export async function updateProfileBasics(formData: FormData) {
  const b = await biz();
  const minDays = Number(formData.get("minDays")) || null;
  const maxDays = Number(formData.get("maxDays")) || null;
  const taxRaw = String(formData.get("taxNumber") || "").replace(/\D/g, "");
  // Vergi/kimlik no checksum doğrulaması — rastgele/uydurma sayı girilemez
  // (11 hane TC, 10 hane VKN). Boş bırakılabilir ama girildiyse geçerli olmalı.
  if (taxRaw && !isValidTaxOrTckn(taxRaw)) {
    redirect(
      "/panel/profil?hata=" +
        encodeURIComponent(
          "Vergi/kimlik numarası geçersiz. Şahıs işletmesi 11 haneli T.C. kimlik, tüzel kişi 10 haneli vergi numarası girer.",
        ),
    );
  }
  await prisma.cleanerBusiness.update({
    where: { id: b.id },
    data: {
      name: String(formData.get("name") || b.name),
      description: String(formData.get("description") || ""),
      address: String(formData.get("address") || b.address),
      district: String(formData.get("district") || b.district),
      city: String(formData.get("city") || b.city),
      phone: String(formData.get("phone") || b.phone),
      taxNumber: taxRaw || null,
      deliveryEstimateMinDays: minDays,
      deliveryEstimateMaxDays: maxDays,
    },
  });
  await syncVisibility(b.id); // vergi no / teslim süresi boşaltılırsa görünürlüğü güncelle
  revalidatePath("/panel/profil");
  revalidatePath("/panel");
}

export async function setWorkingHours(formData: FormData) {
  const b = await biz();
  const wOpen = String(formData.get("weekdayOpen") || "09:00");
  const wClose = String(formData.get("weekdayClose") || "19:00");
  const satOpen = String(formData.get("satOpen") || "");
  const satClose = String(formData.get("satClose") || "");
  const sundayClosed = formData.get("sundayClosed") != null;
  const wd = { open: wOpen, close: wClose };
  await prisma.cleanerBusiness.update({
    where: { id: b.id },
    data: {
      workingHours: {
        mon: wd,
        tue: wd,
        wed: wd,
        thu: wd,
        fri: wd,
        sat: satOpen && satClose ? { open: satOpen, close: satClose } : null,
        sun: sundayClosed ? null : null,
      },
    },
  });
  await syncVisibility(b.id);
  revalidatePath("/panel/profil");
  revalidatePath("/panel");
}

export async function addPricingItem(formData: FormData) {
  const b = await biz();
  const label = String(formData.get("label") || "").trim();
  const price = Number(formData.get("price"));
  const unit = String(formData.get("unit") || "PER_M2") as PricingUnit;
  const isAddon = formData.get("isAddon") != null;
  // Fiyat 0'dan büyük olmalı (negatif fiyat gelir modelini tersine çevirir).
  if (!label || !Number.isFinite(price) || price <= 0) return;
  await prisma.pricingItem.create({
    data: { businessId: b.id, label, price, unit, isAddon },
  });
  await syncVisibility(b.id);
  revalidatePath("/panel/profil");
  revalidatePath("/panel");
}

export async function removePricingItem(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id"));
  await prisma.pricingItem.deleteMany({ where: { id, businessId: b.id } });
  await syncVisibility(b.id); // ana hizmet fiyatı kalmazsa listeden düş
  revalidatePath("/panel/profil");
  revalidatePath("/panel");
}

export async function addServiceArea(formData: FormData) {
  const b = await biz();
  const district = String(formData.get("district") || "").trim();
  const city = String(formData.get("city") || "İstanbul").trim();
  if (!district) return;
  await prisma.serviceArea.create({
    data: { businessId: b.id, city, district },
  });
  await syncVisibility(b.id);
  revalidatePath("/panel/profil");
  revalidatePath("/panel");
}

export async function removeServiceArea(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id"));
  await prisma.serviceArea.deleteMany({ where: { id, businessId: b.id } });
  await syncVisibility(b.id); // hizmet bölgesi kalmazsa listeden düş
  revalidatePath("/panel/profil");
  revalidatePath("/panel");
}

export async function addPhoto(formData: FormData) {
  const b = await biz();
  const url = String(formData.get("url") || "").trim();
  const kind = String(formData.get("kind") || "after");
  const caption = String(formData.get("caption") || "");
  if (!url) return;
  await prisma.businessPhoto.create({
    data: {
      businessId: b.id,
      url,
      isBefore: kind === "before",
      isAfter: kind === "after",
      caption,
    },
  });
  await syncVisibility(b.id);
  revalidatePath("/panel/profil");
  revalidatePath("/panel");
}

export async function removePhoto(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id"));
  await prisma.businessPhoto.deleteMany({ where: { id, businessId: b.id } });
  await syncVisibility(b.id); // fotoğrafsız kalırsa listeden düş
  revalidatePath("/panel/profil");
  revalidatePath("/panel");
}

export async function addDriver(formData: FormData) {
  const b = await biz();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const chosen = String(formData.get("password") || "");
  if (!name || phone.length < 10) {
    throw new Error("Geçerli ad ve telefon (05xx...) girin.");
  }
  if (chosen && chosen.length < 8) {
    throw new Error("Şifre en az 8 karakter olmalı.");
  }
  const exists = await prisma.user.findUnique({ where: { phone } });
  if (exists) {
    // Sessiz başarısızlık yerine halıcıya neden eklenemediğini söyle.
    throw new Error("Bu telefon numarası başka bir hesapta zaten kayıtlı.");
  }
  // Şifreyi halıcı belirleyebilir (SMS canlı olana kadar tek pratik yol).
  // Boş bırakılırsa eski davranış: rastgele geçici şifre + SMS. Sabit "1234" YOK.
  const tempPassword = chosen || crypto.randomBytes(6).toString("base64url");
  const password = await hashPassword(tempPassword);
  const user = await prisma.user.create({
    data: { role: "DRIVER", name, phone, password },
  });
  await prisma.driver.create({
    data: { userId: user.id, businessId: b.id },
  });
  try {
    // Halıcı şifreyi kendisi belirlediyse SMS'te şifre GEÇMEZ (sözlü iletir).
    await sendSms(
      phone,
      chosen
        ? `${b.name} sizi şoför olarak ekledi. Giriş: ${getAppBaseUrl()}/giris · Telefon: ${phone} · Şifrenizi işletmenizden alabilirsiniz.`
        : `${b.name} sizi şoför olarak ekledi. Giriş: ${getAppBaseUrl()}/giris · Telefon: ${phone} · Geçici şifre: ${tempPassword}`,
    );
  } catch (e) {
    console.error("addDriver SMS hatası:", e);
  }
  await syncVisibility(b.id); // ilk şoför eklenince görünür olabilir
  revalidatePath("/panel/soforler");
  revalidatePath("/panel");
}

export async function removeDriver(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id"));
  // sadece bu işletmenin şoförü silinebilir
  const d = await prisma.driver.findFirst({ where: { id, businessId: b.id } });
  if (!d) return;
  // Aktif (terminal olmayan) siparişi olan şoför silinemez → yetim sipariş olmasın.
  const activeOrders = await prisma.order.count({
    where: {
      driverId: d.id,
      status: { in: ["CREATED", "ACCEPTED", "PICKED_UP", "WASHING", "OUT_FOR_DELIVERY"] },
    },
  });
  if (activeOrders > 0) {
    throw new Error(
      "Bu şoförün aktif siparişi var. Önce siparişleri başka şoföre devredin.",
    );
  }
  await prisma.driver.delete({ where: { id: d.id } });
  await syncVisibility(b.id); // son şoför silindiyse listeden düş
  revalidatePath("/panel/soforler");
  revalidatePath("/panel");
}

/** Şoför şifresini halıcı belirler/sıfırlar (unutulan şifre + SMS-öncesi dönem). */
export async function setDriverPassword(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id"));
  const pw = String(formData.get("password") || "");
  if (pw.length < 8) {
    throw new Error("Şifre en az 8 karakter olmalı.");
  }
  // sadece bu işletmenin şoförü güncellenebilir
  const d = await prisma.driver.findFirst({ where: { id, businessId: b.id } });
  if (!d) return;
  await prisma.user.update({
    where: { id: d.userId },
    data: { password: await hashPassword(pw) },
  });
  revalidatePath("/panel/soforler");
}

export async function acceptContract() {
  const b = await biz();
  await prisma.cleanerBusiness.update({
    where: { id: b.id },
    data: { contractAcceptedAt: new Date() },
  });
  revalidatePath("/panel");
}

export async function submitForVerification() {
  const b = await biz();
  // Zaten doğrulanmışı tekrar PENDING'e düşürme (istemeden görünürlük kaybı, B5).
  if (b.verification === "VERIFIED") return;
  // Eksikse sessiz geçme — halıcıya nedenini söyle (B5).
  if (!profileComplete(b)) throw new Error("Önce profil bilgilerini tamamlayın.");
  if (!b.owner.emailVerified) throw new Error("Önce e-posta adresinizi doğrulayın.");
  if (!b.contractAcceptedAt) throw new Error("Önce platform sözleşmesini onaylayın.");
  await prisma.cleanerBusiness.update({
    where: { id: b.id },
    data: { verification: "PENDING" },
  });
  revalidatePath("/panel");
  revalidatePath("/panel/profil");
}

export async function reassignOrder(formData: FormData) {
  const b = await biz();
  const orderId = String(formData.get("orderId"));
  const driverId = String(formData.get("driverId")) || null;
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId: b.id },
  });
  if (!order) return;
  if (driverId) {
    const d = await prisma.driver.findFirst({
      where: { id: driverId, businessId: b.id },
    });
    if (!d) return;
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { driverId },
  });
  revalidatePath("/panel/siparisler");
}

export async function cancelOrder(formData: FormData) {
  const b = await biz();
  const orderId = String(formData.get("orderId"));
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId: b.id },
  });
  if (!order) return;
  // Yola çıkmış (müşteri takip ediyor) / teslim / zaten iptal-red siparişi iptal etme.
  // OUT_FOR_DELIVERY dışarıda: halı yoldayken iptal = teslim edilemez çelişkisi (B3).
  const cancelable = await prisma.order.updateMany({
    where: {
      id: orderId,
      businessId: b.id,
      status: { in: ["CREATED", "ACCEPTED", "PICKED_UP", "WASHING"] },
    },
    data: { status: "CANCELED" },
  });
  if (cancelable.count === 0) return;
  await prisma.orderEvent.create({
    data: { orderId, status: "CANCELED", note: "Halıcı iptal etti" },
  });
  revalidatePath("/panel/siparisler");
}

// Halıcı, talebi sebep yazarak reddeder; müşteriye bildirim gider.
export async function rejectOrder(formData: FormData) {
  const b = await biz();
  const orderId = String(formData.get("orderId"));
  const preset = String(formData.get("reason") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const reason = [preset || "Belirtilmedi", note].filter(Boolean).join(" — ");
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId: b.id },
  });
  if (!order) return;
  // Reddetme yalnız CREATED'da (şoför tarafıyla tutarlı, B2). Kabul sonrası
  // vazgeçmek için "İptal" (cancelOrder) kullanılır.
  const rejected = await prisma.order.updateMany({
    where: { id: orderId, businessId: b.id, status: "CREATED" },
    data: { status: "REJECTED", rejectReason: reason },
  });
  if (rejected.count === 0) return;
  await prisma.orderEvent.create({
    data: { orderId, status: "REJECTED", note: `Reddedildi: ${reason}` },
  });
  try {
    await sendSms(
      order.customerPhone,
      `Talebiniz maalesef karşılanamadı. Sebep: ${reason}. Başka halıcı seçebilirsiniz: ${getAppBaseUrl()}/halicilar`,
    );
  } catch (e) {
    console.error("rejectOrder SMS hatası:", e);
  }
  revalidatePath("/panel/siparisler");
}

// ————— Sipariş yaşam döngüsü (halıcı yönetimi) —————
// Şoför tarafındaki akışla aynı durum makinesi; tüm geçişler CAS (updateMany +
// status koşulu) ile — çift tık / yarış durumunda ikinci istek sessizce düşer.

/** CREATED → ACCEPTED. Şoför kabulünün panel muadili. */
export async function acceptOrderPanel(formData: FormData) {
  const b = await biz();
  const orderId = String(formData.get("orderId"));
  const accepted = await prisma.order.updateMany({
    where: { id: orderId, businessId: b.id, status: "CREATED" },
    data: { status: "ACCEPTED" },
  });
  if (accepted.count === 0) return;
  await prisma.orderEvent.create({
    data: { orderId, status: "ACCEPTED", note: "Halıcı kabul etti" },
  });
  revalidatePath("/panel/siparisler");
  revalidatePath(`/panel/siparisler/${orderId}`);
}

/**
 * Kesin fiyat bildirimi (Mesafeli Söz. Yön. md.15/1-h ispatı): halı alınıp
 * ölçüldükten sonra işletme kesin fiyatı girer → müşteriye SMS + takip
 * sayfasında onay kartı. Onay gelene kadar fiyat güncellenebilir; müşteri
 * onayladıktan (priceApprovedAt) sonra değiştirilemez.
 */
export async function quoteOrderPrice(formData: FormData) {
  const b = await biz();
  const orderId = String(formData.get("orderId"));
  const price = Number(String(formData.get("price") || "").replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Geçerli bir kesin fiyat girin (0'dan büyük).");
  }
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId: b.id },
  });
  if (!order) return;

  // CAS: yalnız PICKED_UP'ta ve müşteri henüz onaylamamışken bildir/güncelle.
  const updated = await prisma.order.updateMany({
    where: {
      id: orderId,
      businessId: b.id,
      status: "PICKED_UP",
      priceApprovedAt: null,
    },
    data: { quotedPrice: price },
  });
  if (updated.count === 0) {
    throw new Error(
      "Fiyat bildirilemedi: sipariş uygun durumda değil veya müşteri fiyatı zaten onayladı.",
    );
  }
  await prisma.orderEvent.create({
    data: {
      orderId,
      status: "PICKED_UP", // durum değişmez, yalnız kayıt düşülür
      note: `Kesin fiyat bildirildi: ${price} TL — müşteri onayı bekleniyor`,
    },
  });
  // SMS hatası kaydı bozmasın (fiyat zaten yazıldı, kart takip sayfasında görünür).
  try {
    await sendSms(
      order.customerPhone,
      `Kesin fiyat ${price} TL. Onaylamak icin: ${trackingLink(order.code ?? order.trackingToken)}`,
    );
  } catch (e) {
    console.error("quoteOrderPrice SMS hatası:", e);
  }
  revalidatePath("/panel/siparisler");
  revalidatePath(`/panel/siparisler/${orderId}`);
}

/** Ara adımlar: ACCEPTED→PICKED_UP→WASHING→OUT_FOR_DELIVERY (PANEL_NEXT). */
export async function advanceOrderPanel(formData: FormData) {
  const b = await biz();
  const orderId = String(formData.get("orderId"));
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId: b.id },
  });
  if (!order) return;
  const step = PANEL_NEXT[order.status];
  if (!step) return;

  // md.15/1-h: dijital fiyat onayı yokken yıkamaya geçiş, ancak işletmenin
  // "sözlü onay aldım" beyanıyla mümkündür — beyan zaman damgalı kayda geçer.
  const verbalConsent = formData.get("verbalConsent") != null;
  const needsConsentDeclaration =
    order.status === "PICKED_UP" &&
    step.next === "WASHING" &&
    !order.priceApprovedAt;
  if (needsConsentDeclaration && !verbalConsent) {
    throw new Error(
      "Müşterinin dijital fiyat onayı yok. Yıkamaya geçmek için sözlü onay beyanını işaretleyin veya müşterinin takip sayfasından onaylamasını bekleyin.",
    );
  }

  const updated = await prisma.order.updateMany({
    where: { id: orderId, businessId: b.id, status: order.status },
    data: { status: step.next },
  });
  if (updated.count === 0) return;
  await prisma.orderEvent.create({
    data: { orderId, status: step.next, note: ORDER_STATUS_META[step.next].label },
  });
  if (needsConsentDeclaration && verbalConsent) {
    await prisma.orderEvent.create({
      data: {
        orderId,
        status: step.next,
        note: "İşletme beyanı: müşteriden sözlü fiyat/ifa onayı alındı",
      },
    });
  }

  if (step.next === "OUT_FOR_DELIVERY") {
    // Şoför akışıyla aynı: önceki teslimatın konumu sızmasın + canlı takip SMS'i.
    if (order.driverId) {
      await prisma.driver.update({
        where: { id: order.driverId },
        data: { lastLat: null, lastLng: null },
      });
    }
    try {
      await sendSms(
        order.customerPhone,
        `Haliniz yola cikti! Canli takip: ${trackingLink(order.code ?? order.trackingToken)}`,
      );
    } catch (e) {
      console.error("advanceOrderPanel SMS hatası:", e);
    }
  }
  revalidatePath("/panel/siparisler");
  revalidatePath(`/panel/siparisler/${orderId}`);
}

/** OUT_FOR_DELIVERY → DELIVERED + tahsilat tutarı (şoför deliverOrder muadili). */
export async function deliverOrderPanel(formData: FormData) {
  const b = await biz();
  const orderId = String(formData.get("orderId"));
  const price = Number(String(formData.get("price") || "").replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Geçerli bir teslim tutarı girin (0'dan büyük).");
  }
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId: b.id, status: "OUT_FOR_DELIVERY" },
  });
  if (!order) return;

  const isCash = order.paymentMethod === "CASH";
  const updated = await prisma.order.updateMany({
    where: { id: orderId, businessId: b.id, status: "OUT_FOR_DELIVERY" },
    data: {
      status: "DELIVERED",
      priceTotal: price,
      commission: isCash ? 0 : undefined,
      paymentStatus: isCash ? "PAID" : order.paymentStatus,
    },
  });
  if (updated.count === 0) return;
  await prisma.orderEvent.create({
    data: {
      orderId,
      status: "DELIVERED",
      note: isCash
        ? `Teslim edildi · ${price} TL nakit tahsil edildi`
        : `Teslim edildi · ${price} TL (kartla ödeme bekleniyor)`,
    },
  });
  revalidatePath("/panel/siparisler");
  revalidatePath(`/panel/siparisler/${orderId}`);
}

/** Tahmini teslim süresi (gün) — müşteri takip sayfasında görür. */
export async function setOrderEta(formData: FormData) {
  const b = await biz();
  const orderId = String(formData.get("orderId"));
  const days = Math.round(Number(formData.get("days")));
  if (!Number.isFinite(days) || days < 1 || days > 60) return;
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      businessId: b.id,
      status: { notIn: ["DELIVERED", "CANCELED", "REJECTED"] },
    },
  });
  if (!order) return;
  await prisma.order.update({
    where: { id: orderId },
    data: { estimatedDays: days },
  });
  await prisma.orderEvent.create({
    data: {
      orderId,
      status: order.status,
      note: `Tahmini teslim güncellendi: ~${days} gün`,
    },
  });
  revalidatePath("/panel/siparisler");
  revalidatePath(`/panel/siparisler/${orderId}`);
}
