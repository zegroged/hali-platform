"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  bildirAraAdim,
  bildirSiparisKesintisi,
  bildirTeslimEdildi,
  bildirMusteriyeEposta,
} from "@/lib/orderNotify";
import { parseTutar } from "@/lib/money";
import {
  getCurrentBusiness,
  getPanelBusiness,
  profileComplete,
  syncVisibility,
} from "@/lib/panel";
import { hashPassword } from "@/lib/auth";
import { sendSms, trackingLink } from "@/lib/sms";
import { waSiparisYolda, waFiyatOnayi, waSiparisHazir, waGonderVeKaydet } from "@/lib/whatsapp";
import { sendAdminEmail, sendEmail } from "@/lib/email";
import { notify, notifyAdmins } from "@/lib/notify";
import { getAppBaseUrl } from "@/lib/config";
import { ORDER_STATUS_META, PANEL_NEXT } from "@/lib/orderStatus";
import { normalizeCarpetCount, CARPET_COUNT_HATA } from "@/lib/carpet";
import { hataylaDon } from "@/lib/hata";
import { taxIdError } from "@/lib/taxId";
import { normalizePhone, isMobilePhone, isLandlinePhone } from "@/lib/phone";
import { normalizeGoogleProfileUrl } from "@/lib/googleUrl";
import { normalizeCityName, normalizeDistrictName } from "@/lib/cities";
import { normalizeUsername, validateUsername } from "@/lib/username";
import { escapeHtml } from "@/lib/htmlSafe";
import type { PricingUnit } from "@prisma/client";
import {
  normalizeBusinessName,
  normalizeBusinessDescription,
  normalizeAddress,
} from "@/lib/text";

/**
 * SAHİBE ÖZEL işletme bağlamı. `getCurrentBusiness()` yalnız CLEANER kabul
 * ettiği için bu fonksiyonu kullanan HER aksiyon otomatik olarak sahibe
 * özeldir — çalışan çağırırsa /giris'e düşer. Profil, fiyat, şoför, sözleşme,
 * abonelik ve tatil modu aksiyonları bilerek burada kalır (fail-closed).
 */
async function biz() {
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");
  return b;
}

/**
 * PAYLAŞILAN işletme bağlamı — SAHİP **veya** ÇALIŞAN (2026-08-06).
 * Yalnız günlük sipariş işleri için: kabul, red, fiyat bildirme, aşama
 * ilerletme, teslim, ETA, şoför devri, "hazır" haberi.
 *
 * ⚠️ Yeni bir aksiyon yazarken varsayılanın `biz()` olduğunu unutma; buraya
 * ancak dükkândaki çalışanın yapması GEREKEN işler taşınır.
 */
async function bizPaylasilan() {
  const b = await getPanelBusiness();
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
  const taxErr = taxIdError(taxRaw);
  if (taxErr) {
    redirect("/panel/profil?hata=" + encodeURIComponent(taxErr));
  }
  // Google profil linki — girildiyse gerçek bir Google alan adı olmalı.
  const googleRaw = String(formData.get("googleProfileUrl") || "").trim();
  const googleUrl = googleRaw ? normalizeGoogleProfileUrl(googleRaw) : null;
  if (googleRaw && !googleUrl) {
    redirect(
      "/panel/profil?hata=" +
        encodeURIComponent(
          "Google profil linki geçersiz. Google Haritalar'daki işletme sayfanın linkini yapıştır (google.com/maps... veya g.page/...).",
        ),
    );
  }
  // TELEFONLAR — birincil GSM zorunlu (SMS bildirimleri + WhatsApp), ikinci GSM
  // ve sabit hat opsiyonel. Eskiden burada hiç doğrulama yoktu; ham string
  // yazılıyordu (kayıttaki regex güncellemede uygulanmıyordu).
  const phone = normalizePhone(String(formData.get("phone") || b.phone));
  const gsm2Raw = String(formData.get("gsmPhone2") || "").trim();
  const gsmPhone2 = gsm2Raw ? normalizePhone(gsm2Raw) : null;
  const landRaw = String(formData.get("landlinePhone") || "").trim();
  const landlinePhone = landRaw ? normalizePhone(landRaw) : null;
  if (!isMobilePhone(phone)) {
    redirect(
      "/panel/profil?hata=" +
        encodeURIComponent(
          "Birincil telefon 05xx ile başlayan 11 haneli GSM olmalı (SMS bildirimleri ve WhatsApp bu numaraya göre çalışır). Sabit hattını alttaki Sabit Hat alanına yaz.",
        ),
    );
  }
  if (gsmPhone2 && !isMobilePhone(gsmPhone2)) {
    redirect(
      "/panel/profil?hata=" +
        encodeURIComponent("İkinci GSM numarası 05xx ile başlayan 11 hane olmalı."),
    );
  }
  if (gsmPhone2 === phone) {
    redirect(
      "/panel/profil?hata=" +
        encodeURIComponent("İkinci GSM, birincil numarayla aynı olamaz."),
    );
  }
  if (landlinePhone && !isLandlinePhone(landlinePhone)) {
    redirect(
      "/panel/profil?hata=" +
        encodeURIComponent(
          "Sabit hat 0 + il koduyla başlayan 11 hane olmalı (örn. 0324 320 16 42). Cep numaranı GSM alanına yaz.",
        ),
    );
  }
  // İl/ilçe yalnız resmî listeden: yazım hatası şehir sayfası (/hali-yikama/..)
  // ve ilçe eşleşmesini bozuyordu. Kanonik ada normalize edilir, listede yoksa red.
  const cityCanon = normalizeCityName(String(formData.get("city") || b.city));
  const districtCanon = cityCanon
    ? normalizeDistrictName(
        cityCanon,
        String(formData.get("district") || b.district),
      )
    : null;
  if (!cityCanon || !districtCanon) {
    redirect(
      "/panel/profil?hata=" +
        encodeURIComponent("İl ve ilçe listeden seçilmeli."),
    );
  }
  await prisma.cleanerBusiness.update({
    where: { id: b.id },
    data: {
      // BÜYÜK HARF normalize: herkes bağırarak yazıyordu, kartlar çirkinleşiyordu.
      name: normalizeBusinessName(String(formData.get("name") || b.name)),
      description: normalizeBusinessDescription(
        String(formData.get("description") || ""),
      ),
      address: normalizeAddress(String(formData.get("address") || b.address)),
      district: districtCanon,
      city: cityCanon,
      phone,
      gsmPhone2,
      landlinePhone,
      taxNumber: taxRaw || null,
      // Fatura bilgileri (abonelik faturası için) — boş→null.
      billingTitle: String(formData.get("billingTitle") || "").trim() || null,
      taxOffice: String(formData.get("taxOffice") || "").trim() || null,
      billingAddress:
        normalizeAddress(String(formData.get("billingAddress") || "")) || null,
      googleProfileUrl: googleUrl,
      deliveryEstimateMinDays: minDays,
      deliveryEstimateMaxDays: maxDays,
    },
  });
  await syncVisibility(b.id); // vergi no / teslim süresi boşaltılırsa görünürlüğü güncelle
  revalidatePath("/panel/profil");
  revalidatePath("/panel");
  // Kaydet'e basınca hiçbir şey olmuyor gibi görünüyordu — görünür geri bildirim.
  redirect("/panel/profil?kaydedildi=Temel+bilgiler");
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
  redirect("/panel/profil?kaydedildi=Çalışma+saatleri");
}

// Birim istemciden gelir; tanımsız bir değer Prisma'da enum hatası (500) verirdi.
// Bilinmeyeni sessizce /m²'ye düşürüyoruz — halıcı satırdan düzeltebilir.
const BIRIMLER: PricingUnit[] = ["PER_M2", "PER_PIECE", "FLAT"];
function birimOku(raw: FormDataEntryValue | null): PricingUnit {
  const v = String(raw || "") as PricingUnit;
  return BIRIMLER.includes(v) ? v : "PER_M2";
}

export async function addPricingItem(formData: FormData) {
  const b = await biz();
  const label = String(formData.get("label") || "").trim();
  const price = parseTutar(formData.get("price"));
  const unit = birimOku(formData.get("unit"));
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

/**
 * Fiyat kalemini yerinde günceller. Öncesinde zam yapmak "sil + yeniden ekle"
 * demekti; kalem listenin sonuna düşüyor ve bir an fiyatsız kalıyordu.
 *
 * İZOLASYON: updateMany + businessId koşulu — başka işletmenin kalemi where'e
 * takılmaz, 0 satır güncellenir (findUnique + kontrol yerine tek sorgu).
 */
export async function updatePricingItem(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id") || "");
  const label = String(formData.get("label") || "").trim();
  const price = parseTutar(formData.get("price"));
  const unit = birimOku(formData.get("unit"));
  const isAddon = formData.get("isAddon") != null;
  if (!id || !label || !Number.isFinite(price) || price <= 0) return;
  await prisma.pricingItem.updateMany({
    where: { id, businessId: b.id },
    data: { label, price, unit, isAddon },
  });
  // Tek ana kalem "ek hizmet"e çevrilirse işletme yayın şartını kaybeder.
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
  // İl formdan gelmez, işletmenin kendi ilinden alınır (eski form sabit
  // "İstanbul" gönderiyordu — başka ildeki işletme yanlış şehre atanıyordu).
  // İlçe o ilin resmî listesinde olmalı.
  const city = normalizeCityName(b.city);
  if (!city) return;
  const district = normalizeDistrictName(
    city,
    String(formData.get("district") || ""),
  );
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
  // Şoförün GİRİŞ KİMLİĞİ: kullanıcı adı (telefonla giriş kaldırıldı, şoförün
  // e-postası yok). Halıcı belirler ve şoförüne iletir — şifrede olduğu gibi.
  const username = normalizeUsername(String(formData.get("username") || ""));
  if (!name || phone.length < 10) {
    hataylaDon("/panel/soforler", "Ad soyad ve 05xx ile başlayan 11 haneli telefon girin.");
  }
  const usernameError = validateUsername(username);
  if (usernameError) hataylaDon("/panel/soforler", usernameError);
  if (chosen && chosen.length < 8) {
    hataylaDon("/panel/soforler", "Şifre en az 8 karakter olmalı (şoföre sen ileteceksin).");
  }
  // NUMARA ÇAKIŞMASI ARTIK ENGEL DEĞİL (2026-08-07 akşam — çalışan tarafıyla
  // AYNI karar, gerekçesi prisma/schema.prisma `User.phone` notunda):
  // telefon doğrulanmıyor ve girişte kullanılmıyor, yani kimlik değil.
  // Daha önce müşteri olarak sipariş vermiş biri şoför olarak eklenebilmeli.
  const exists = await prisma.user.findFirst({
    where: { username },
    select: { id: true },
  });
  if (exists) {
    // Sessiz başarısızlık yerine halıcıya neden eklenemediğini söyle.
    hataylaDon(
      "/panel/soforler",
      `"${username}" kullanıcı adı başkası tarafından alınmış. Başka bir ad deneyin.`,
    );
  }
  // Şifreyi halıcı belirleyebilir (SMS canlı olana kadar tek pratik yol).
  // Boş bırakılırsa eski davranış: rastgele geçici şifre + SMS. Sabit "1234" YOK.
  const tempPassword = chosen || crypto.randomBytes(6).toString("base64url");
  const password = await hashPassword(tempPassword);
  const user = await prisma.user.create({
    data: { role: "DRIVER", name, phone, username, password },
  });
  await prisma.driver.create({
    data: { userId: user.id, businessId: b.id },
  });
  try {
    // Halıcı şifreyi kendisi belirlediyse SMS'te şifre GEÇMEZ (sözlü iletir).
    await sendSms(
      phone,
      chosen
        ? `${b.name} sizi şoför olarak ekledi. Giriş: ${getAppBaseUrl()}/giris · Kullanıcı adı: ${username} · Şifrenizi işletmenizden alabilirsiniz.`
        : `${b.name} sizi şoför olarak ekledi. Giriş: ${getAppBaseUrl()}/giris · Kullanıcı adı: ${username} · Geçici şifre: ${tempPassword}`,
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
    hataylaDon(
      "/panel/soforler",
      `Bu şoförün ${activeOrders} aktif siparişi var. Silmeden önce siparişleri başka şoföre devret (Siparişler → ilgili sipariş → şoför değiştir).`,
    );
  }
  await prisma.driver.delete({ where: { id: d.id } });
  await syncVisibility(b.id); // son şoför silindiyse listeden düş
  revalidatePath("/panel/soforler");
  revalidatePath("/panel");
}

/**
 * Şoförün GİRİŞ KİMLİĞİNİ (kullanıcı adı) halıcı değiştirir. Şoförün e-postası
 * olmadığından kullanıcı adı tek kimliğidir — yanlış/çakışan bir ad girildiğinde
 * elle SQL gerekmemesi için bu aksiyon şart.
 */
export async function setDriverUsername(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id"));
  const username = normalizeUsername(String(formData.get("username") || ""));
  const err = validateUsername(username);
  if (err) hataylaDon("/panel/soforler", err);
  // sadece bu işletmenin şoförü güncellenebilir
  const d = await prisma.driver.findFirst({ where: { id, businessId: b.id } });
  if (!d) return;
  const taken = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (taken && taken.id !== d.userId) {
    hataylaDon("/panel/soforler", `"${username}" kullanıcı adı başkası tarafından alınmış. Başka bir ad deneyin.`);
  }
  await prisma.user.update({ where: { id: d.userId }, data: { username } });
  revalidatePath("/panel/soforler");
}

/** Şoför şifresini halıcı belirler/sıfırlar (unutulan şifre + SMS-öncesi dönem). */
export async function setDriverPassword(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id"));
  const pw = String(formData.get("password") || "");
  if (pw.length < 8) {
    hataylaDon("/panel/soforler", "Şifre en az 8 karakter olmalı.");
  }
  // sadece bu işletmenin şoförü güncellenebilir
  const d = await prisma.driver.findFirst({ where: { id, businessId: b.id } });
  if (!d) return;
  await prisma.user.update({
    where: { id: d.userId },
    // sessionsValidFrom: işten çıkarılan/şifresi sıfırlanan şoförün
    // telefonundaki 30 günlük Bearer token'ı ANINDA geçersiz kılar (2026-07-28).
    data: { password: await hashPassword(pw), sessionsValidFrom: new Date() },
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
  if (!profileComplete(b))
    hataylaDon("/panel", "Doğrulamaya göndermeden önce profil bilgilerini tamamlayın (Profil & Fiyat sayfasındaki eksikler listesine bakın).");
  if (!b.owner.emailVerified)
    hataylaDon("/panel", "Doğrulamaya göndermeden önce e-posta adresinizi doğrulayın (Özet sayfasındaki E-posta Doğrulama bölümü).");
  if (!b.contractAcceptedAt)
    hataylaDon("/panel", "Doğrulamaya göndermeden önce platform sözleşmesini onaylayın (Özet sayfasının altında).");
  await prisma.cleanerBusiness.update({
    where: { id: b.id },
    data: { verification: "PENDING" },
  });
  // Admin haberdar olmazsa talep panel elle açılana dek bekliyordu — hem
  // uygulama-içi (admin paneli zili) hem e-posta (canlı) ile bildir.
  await notifyAdmins({
    type: "dogrulama",
    title: "Yeni doğrulama talebi",
    body: `${b.name} (${b.district}/${b.city})`,
    href: `/admin/isletme/${b.id}`,
  });
  try {
    // İşletme adı/il/ilçe serbest metin → HTML'e kaçırarak göm (admin mailine
    // link/img enjeksiyonu olmasın, denetim bulgusu).
    await sendAdminEmail(
      `Doğrulama talebi: ${b.name}`,
      `<p style="margin:0 0 12px;"><strong>${escapeHtml(b.name)}</strong> (${escapeHtml(b.district)}/${escapeHtml(b.city)}) doğrulanmış rozeti için başvurdu.</p>
       <p style="margin:0;"><a href="${getAppBaseUrl()}/admin/isletme/${b.id}" style="color:#0f766e;">Admin panelinde incele →</a></p>`,
    );
  } catch (e) {
    console.error("doğrulama talebi admin e-postası hatası:", e);
  }
  revalidatePath("/panel");
  revalidatePath("/panel/profil");
}

export async function reassignOrder(formData: FormData) {
  const b = await bizPaylasilan();
  const orderId = String(formData.get("orderId"));
  const driverId = String(formData.get("driverId")) || null;
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId: b.id },
  });
  if (!order) return;
  let newDriverPhone: string | null = null;
  let newDriverUserId: string | null = null;
  if (driverId) {
    const d = await prisma.driver.findFirst({
      where: { id: driverId, businessId: b.id },
      include: { user: { select: { phone: true } } },
    });
    if (!d) return;
    newDriverPhone = d.user.phone;
    newDriverUserId = d.userId;
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { driverId },
  });
  // Yeni atanan şoför işi bilsin (yalnız GERÇEKTEN değiştiyse — aynı şoföre
  // tekrar "Ata" basılınca bildirim gitmesin; gereksiz bildirim yok ilkesi).
  if (newDriverUserId && driverId !== order.driverId) {
    await notify({
      userId: newDriverUserId,
      type: "is-atandi",
      title: "Sana bir iş atandı",
      body: `Kod: ${order.code ?? ""}`,
      href: "/sofor",
    });
    try {
      await sendSms(
        newDriverPhone!,
        `Size yeni is atandi! Kod: ${order.code ?? ""}. Detay: ${getAppBaseUrl()}/sofor`,
      );
    } catch (e) {
      console.error("reassignOrder şoför SMS hatası:", e);
    }
  }
  revalidatePath("/panel/siparisler");
}

export async function cancelOrder(formData: FormData) {
  const b = await bizPaylasilan();
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
  // Müşteri evde alım/teslim bekliyor olabilir — iptali MUTLAKA bilsin
  // (rejectOrder SMS'li, iptal SMS'siz kalmıştı; tutarsızlık giderildi).
  const wasPickedUp = ["PICKED_UP", "WASHING"].includes(order.status);
  try {
    await sendSms(
      order.customerPhone,
      `Siparisiniz (${order.code ?? ""}) isletme tarafindan iptal edildi.` +
        (wasPickedUp
          ? " Haliniz yikanmadan adresinize iade edilecek, ucret talep edilmez."
          : "") +
        ` Sorulariniz icin: ${b.phone}`,
    );
  } catch (e) {
    console.error("cancelOrder müşteri SMS hatası:", e);
  }
  // SMS bu projede MOCK — asıl bildirim buradan gider (2026-07-28 denetim).
  await bildirSiparisKesintisi({
    orderId,
    tur: "iptal",
    kaynak: "isletme",
    aliniMisti: wasPickedUp,
  });
  revalidatePath("/panel/siparisler");
}

// Halıcı, talebi sebep yazarak reddeder; müşteriye bildirim gider.
export async function rejectOrder(formData: FormData) {
  const b = await bizPaylasilan();
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
  await bildirSiparisKesintisi({
    orderId,
    tur: "red",
    kaynak: "isletme",
    sebep: reason,
  });
  revalidatePath("/panel/siparisler");
}

// ————— Sipariş yaşam döngüsü (halıcı yönetimi) —————
// Şoför tarafındaki akışla aynı durum makinesi; tüm geçişler CAS (updateMany +
// status koşulu) ile — çift tık / yarış durumunda ikinci istek sessizce düşer.

/** CREATED → ACCEPTED. Şoför kabulünün panel muadili. */
export async function acceptOrderPanel(formData: FormData) {
  const b = await bizPaylasilan();
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
  const b = await bizPaylasilan();
  const orderId = String(formData.get("orderId"));
  const price = parseTutar(formData.get("price"));
  if (!Number.isFinite(price) || price <= 0) {
    hataylaDon(`/panel/siparisler/${orderId}`, "Geçerli bir kesin fiyat girin (0'dan büyük bir tutar).");
  }
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId: b.id },
  });
  if (!order) return;

  // 🔴 ÇİFT BİLDİRİM FRENİ (2026-08-07 akşam — canlı veride yakalandı).
  // Prod kaydı: aynı müşteriye 14:21:00 ve 14:21:03'te AYNI fiyat mesajı iki
  // kez gitti. Sebep: buton iki kez gönderilebiliyor ve CAS koşulu (durum
  // PICKED_UP + onaysız) ikinci istekte de sağlandığı için mesaj tekrar
  // gidiyordu. Müşteriye üst üste iki bildirim gitmesi hem güven kırıyor hem
  // her mesaj Meta'da ücretli.
  // FREN: aynı fiyat son 5 dakikada zaten bildirildiyse yeniden GÖNDERME.
  // Fiyat DEĞİŞTİYSE serbest — halıcı düzeltme yapabilmeli.
  // Decimal → number (Prisma Decimal ile === çalışmaz, sessizce false döner).
  if (order.quotedPrice != null && Number(order.quotedPrice) === price) {
    const yakinBildirim = await prisma.orderEvent.findFirst({
      where: {
        orderId,
        note: { startsWith: "Kesin fiyat bildirildi" },
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (yakinBildirim) {
      revalidatePath(`/panel/siparisler/${orderId}`);
      hataylaDon(
        `/panel/siparisler/${orderId}`,
        `${price} TL zaten az önce bildirildi — müşteriye ikinci mesaj gönderilmedi. Fiyatı değiştirirsen yeni bildirim gider.`,
      );
    }
  }

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
    hataylaDon(
      `/panel/siparisler/${orderId}`,
      "Fiyat bildirilemedi: sipariş uygun durumda değil ya da müşteri fiyatı bu arada onayladı. Sayfayı yenileyip güncel duruma bak.",
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
      `Kesin fiyat ${price} TL. Onaylamak icin: ${trackingLink(order.trackingToken)}`,
    );
    // WhatsApp: tutar Meta şablonunda geçemiyor (pazarlama sayılıyor), müşteri
    // takip sayfasında görüp onaylıyor.
    void waGonderVeKaydet({
      orderId,
      status: "PICKED_UP",
      ownerUserId: b.ownerId,
      etiket: "Fiyat onayı",
      metin: "Halınızın ölçümü tamamlandı, kesin fiyat onayınız bekleniyor.",
      gonder: () =>
        waFiyatOnayi(
          order.customerPhone,
          order.customerName,
          b.name,
          order.code ?? "",
          order.trackingToken,
        ),
    });
  } catch (e) {
    console.error("quoteOrderPrice SMS hatası:", e);
  }
  // E-posta da gitsin — WhatsApp kapalıyken tek kanal buydu (2026-07-28).
  await bildirMusteriyeEposta(orderId, "fiyat-onayi");
  revalidatePath("/panel/siparisler");
  revalidatePath(`/panel/siparisler/${orderId}`);
}

/** Ara adımlar: ACCEPTED→PICKED_UP→WASHING→OUT_FOR_DELIVERY (PANEL_NEXT). */
export async function advanceOrderPanel(formData: FormData) {
  const b = await bizPaylasilan();
  const orderId = String(formData.get("orderId"));
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId: b.id },
  });
  if (!order) return;
  const step = PANEL_NEXT[order.status];
  if (!step) return;

  // 🔴 KESİN FİYAT BİLDİRİMİ ZORUNLU (2026-08-02 kullanıcı kararı).
  // Öncesinde "Kesin fiyat bildir" isteğe bağlıydı; atlandığında müşteriye
  // fiyat onayı mesajı HİÇ gitmiyordu (tipik akışta yalnız 2 bildirim kalması
  // bundandı) ve teslimde tutar tartışması ispatsız kalıyordu. Artık ölçüm
  // yapılmadan yıkamaya geçilemez.
  if (order.status === "PICKED_UP" && step.next === "WASHING" && order.quotedPrice == null) {
    hataylaDon(
      `/panel/siparisler/${orderId}`,
      "Yıkamaya geçmeden önce KESİN FİYAT bildirmelisin. Halıyı ölç, aşağıdaki \"Kesin fiyat bildir\" alanına tutarı gir — müşteriye onay bildirimi gitsin.",
    );
  }

  // md.15/1-h: dijital fiyat onayı yokken yıkamaya geçiş, ancak işletmenin
  // "sözlü onay aldım" beyanıyla mümkündür — beyan zaman damgalı kayda geçer.
  const verbalConsent = formData.get("verbalConsent") != null;
  const needsConsentDeclaration =
    order.status === "PICKED_UP" &&
    step.next === "WASHING" &&
    !order.priceApprovedAt;
  if (needsConsentDeclaration && !verbalConsent) {
    hataylaDon(
      `/panel/siparisler/${orderId}`,
      "Müşterinin dijital fiyat onayı yok. Yıkamaya geçmek için sözlü onay beyanını işaretleyin veya müşterinin takip sayfasından onaylamasını bekleyin.",
    );
  }

  // HALI SAYISI — ALIM ANINDA (2026-08-06, şoför web + şoför uygulamasıyla İKİZ).
  // Numaralar 1..N olarak buradan doğar; öncesinde fotoğraftan doğuyordu, yani
  // fotoğrafı çekilmeyen halı sistemde hiç yoktu (bkz. lib/carpet.ts).
  const sayi = normalizeCarpetCount(formData.get("carpetCount"));
  if (sayi === "gecersiz") hataylaDon(`/panel/siparisler/${orderId}`, CARPET_COUNT_HATA);

  const updated = await prisma.order.updateMany({
    where: { id: orderId, businessId: b.id, status: order.status },
    data: {
      status: step.next,
      // Alım anı: Halı Bul ekranı bunu gösterip arıyor (2026-08-07 akşam).
      // İKİZ: lib/driverOrders.ts + app/sofor/actions.ts — üç alım yolu da yazar.
      ...(step.next === "PICKED_UP" ? { pickedUpAt: new Date() } : {}),
      ...(step.next === "PICKED_UP" && sayi != null
        ? { carpetCount: sayi }
        : {}),
    },
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

  // ⚠️ FOTOĞRAFSIZ ALIM DÜRÜSTÇE KAYDA GEÇER (2026-07-28 denetim — YÜKSEK).
  //
  // Şoför akışı (lib/driverOrders.ts, app/sofor) alım/teslimde fotoğrafı ZORUNLU
  // tutuyor; panelden ilerletme ise hiç sormuyordu. Müşteriye "Fotoğraflı
  // Güvence" sözü verdiğimiz için bu sessiz atlama kabul edilemez: en azından
  // kanıt OLMADIĞI zaman damgalı olarak yazılsın ki hasar tartışmasında
  // "fotoğraf yok" gerçeği görünsün. (Tam çözüm: panel formuna da fotoğraf
  // yükleme alanı — ayrıca yapılacak.)
  if (step.next === "PICKED_UP" && !order.pickupPhotoUrl) {
    await prisma.orderEvent.create({
      data: {
        orderId,
        status: "PICKED_UP",
        note: "⚠️ Alım fotoğrafı ÇEKİLMEDEN panelden ilerletildi — hasar kanıtı yok",
      },
    });
  }
  // NOT: Buradaki "teslim fotoğrafı yok" dalı ÖLÜ KODDU (2026-07-29 denetimi).
  // `step` PANEL_NEXT'ten geliyor, PANEL_NEXT ise yalnız ACCEPTED→PICKED_UP→
  // WASHING→OUT_FOR_DELIVERY tanımlıyor; DELIVERED buradan hiç geçmiyor.
  // Panelden teslim `deliverOrderPanel` ile yapılıyor — kayıt oraya taşındı.

  // ARA ADIM BİLDİRİMLERİ (e-posta + WhatsApp).
  // ⚠️ İKİZ KURAL: aynı çağrılar şoför web (sofor/actions) ve şoför uygulaması
  // (lib/driverOrders) yollarında da var — üçü birlikte değişir.
  if (step.next === "PICKED_UP") {
    await bildirAraAdim(orderId, "alindi");
  }
  if (step.next === "WASHING") {
    await bildirAraAdim(orderId, "yikama");
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
        `Haliniz yola cikti! Canli takip: ${trackingLink(order.trackingToken)}`,
      );
      void waGonderVeKaydet({
        orderId,
        status: "OUT_FOR_DELIVERY",
        ownerUserId: b.ownerId,
        etiket: "Teslimat bilgisi",
        metin: "Halınız teslimata çıktı, şoförümüz yolda.",
        gonder: () =>
          waSiparisYolda(
            order.customerPhone,
            order.customerName,
            b.name,
            order.code ?? "",
            order.trackingToken,
          ),
      });
    } catch (e) {
      console.error("advanceOrderPanel SMS hatası:", e);
    }
    // İKİZ (2026-08-02 denetim açığı): şoför yollarındaki "yolda" e-postası
    // panel yolunda eksikti — WhatsApp'ı olmayan müşteri haberi hiç almıyordu.
    await bildirMusteriyeEposta(orderId, "yolda");
  }
  revalidatePath("/panel/siparisler");
  revalidatePath(`/panel/siparisler/${orderId}`);
}

/** OUT_FOR_DELIVERY → DELIVERED + tahsilat tutarı (şoför deliverOrder muadili). */
export async function deliverOrderPanel(formData: FormData) {
  const b = await bizPaylasilan();
  const orderId = String(formData.get("orderId"));
  const price = parseTutar(formData.get("price"));
  if (!Number.isFinite(price) || price <= 0) {
    hataylaDon(`/panel/siparisler/${orderId}`, "Geçerli bir teslim tutarı girin (0'dan büyük bir tutar).");
  }
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId: b.id, status: "OUT_FOR_DELIVERY" },
  });
  if (!order) return;

  const isCash = order.paymentMethod === "CASH";
  // TAHSILAT SECIMI (2026-07-30): "Nakit aldim" | "IBAN'a geldi" | "Almadim".
  // IBAN AYRI TUTULUYOR cunku o para ZATEN isletmenin hesabinda -- soforun
  // uzerinde nakit BIRAKMAZ. Ikisi karisirsa halici soforden olmayan parayi
  // ister. Eski istemciler alan gondermezse (mobil uygulama) nakit sayilir.
  const secim = String(formData.get("collected") ?? "CASH");
  const tahsilEdildi = isCash && secim !== "NO";
  const yontem = secim === "IBAN" ? "IBAN" : "CASH";
      // TAHSİLAT ARTIK BEYAN (2026-07-29): eskiden nakit teslimde
      // paymentStatus KOŞULSUZ "PAID" yazılıyordu — sistem parayı almadığımız
      // hâlde "tahsil edildi" diyordu. Bu yalan üç özelliği birden kilitliyordu
      // (gün sonu mutabakatı, kurumsal cari, ödeme linki). Artık teslim eden
      // kişi "tahsil ettim" der; demezse sipariş "teslim edildi, tahsil
      // edilmedi" durumunda kalır. Varsayılan nakitte İŞARETLİ gelir, yani
      // olağan akışta halıcı için hiçbir şey değişmez.
  const updated = await prisma.order.updateMany({
    where: { id: orderId, businessId: b.id, status: "OUT_FOR_DELIVERY" },
    data: {
      status: "DELIVERED",
      deliveredAt: new Date(),
      priceTotal: price,
      commission: isCash ? 0 : undefined,
      paymentStatus: tahsilEdildi ? "PAID" : order.paymentStatus,
      collectedAmount: tahsilEdildi ? price : undefined,
      collectedAt: tahsilEdildi ? new Date() : undefined,
      collectedById: tahsilEdildi ? b.ownerId : undefined,
      collectedMethod: tahsilEdildi ? yontem : undefined,
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
  // KANIT ZİNCİRİNİN İKİ EKSİĞİ KAPATILDI (2026-07-29 denetimi).
  //
  // 1) Fotoğrafsız teslim: şoför akışında teslim fotoğrafı sunucuda ZORUNLU
  //    (sofor/actions.ts), ama panelden teslimde hiç istenmiyordu ve bunu
  //    kayda geçiren dal ölü koddaydı. "Fotoğraflı kayıt" satılan bir özellik;
  //    fotoğrafın YOKLUĞU da en az kendisi kadar kayda değer.
  // 2) Onaylanan fiyattan sapma: müşterinin onayladığı tutar (quotedPrice)
  //    kilitli ama teslimde tahsil edilen tutar serbest ve karşılaştırılmıyordu.
  //    Sapma engellenmiyor (ek halı/hizmet meşru olabilir) ama artık GÖRÜNÜR.
  const uyarilar: string[] = [];
  if (!order.deliveryPhotoUrl) {
    uyarilar.push(
      "⚠️ Teslim fotoğrafı ÇEKİLMEDEN panelden teslim edildi — teslim kanıtı yok",
    );
  }
  const onaylanan = order.priceApprovedAt ? Number(order.quotedPrice) : null;
  if (onaylanan != null && Number.isFinite(onaylanan) && onaylanan !== price) {
    uyarilar.push(
      `⚠️ Tahsil edilen tutar müşterinin onayladığı tutardan farklı: onaylanan ${onaylanan} TL, tahsil edilen ${price} TL`,
    );
  }
  for (const note of uyarilar) {
    await prisma.orderEvent.create({
      data: { orderId, status: "DELIVERED", note },
    });
  }
  // Müşteriye kapanış: e-posta + WhatsApp + değerlendirme daveti (2026-07-28).
  // ÜÇ AKIŞ DA bağlanır (panel / şoför web / şoför uygulaması) — DEVIR §9/7.
  await bildirTeslimEdildi(orderId);
  revalidatePath("/panel/siparisler");
  revalidatePath(`/panel/siparisler/${orderId}`);
}

/** Tahmini teslim süresi (gün) — müşteri takip sayfasında görür. */
export async function setOrderEta(formData: FormData) {
  const b = await bizPaylasilan();
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

/**
 * Tatil modu: verilen tarihe (TR gün sonu) kadar YENİ kamu siparişini kapat;
 * profil yayında kalır, panelden manuel kayıt etkilenmez. Boş tarih = kaldır.
 * En fazla 90 gün ileri (yanlışlıkla kalıcı kapanma olmasın).
 */
export async function setPauseMode(formData: FormData) {
  const b = await biz();
  const raw = String(formData.get("pausedUntil") || "").trim();
  if (!raw) {
    await prisma.cleanerBusiness.update({
      where: { id: b.id },
      data: { pausedUntil: null },
    });
    revalidatePath("/panel");
    redirect("/panel?kaydedildi=Duraklatma+kaldırıldı");
  }
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return;
  // Karşılaştırma TAKVİM GÜNÜ bazında (TR): anlık saatle kıyas, takvimin izin
  // verdiği son günü sunucuda reddediyordu (gün sonu 20:59 UTC > now+90g anı).
  const trNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const todayUTC = Date.UTC(
    trNow.getUTCFullYear(),
    trNow.getUTCMonth(),
    trNow.getUTCDate(),
  );
  const diffDays = Math.round((Date.UTC(y, m - 1, d) - todayUTC) / 86400000);
  if (diffDays < 0 || diffDays > 90) {
    redirect(
      "/panel?hata=" +
        encodeURIComponent("Duraklatma tarihi bugünden ileri ve en çok 90 gün olabilir."),
    );
  }
  // TR 23:59:59 = UTC 20:59:59 (kalıcı UTC+3)
  const until = new Date(Date.UTC(y, m - 1, d, 20, 59, 59));
  await prisma.cleanerBusiness.update({
    where: { id: b.id },
    data: { pausedUntil: until },
  });
  revalidatePath("/panel");
  redirect("/panel?kaydedildi=Siparişler+duraklatıldı");
}

/**
 * "MÜŞTERİYE HAZIR HABERİ" (2026-07-31): siparis_hazir şablonu Meta'da onaylı
 * ama hiçbir olaya bağlı değildi — akışta WASHING → OUT_FOR_DELIVERY doğrudan
 * geçiyor, "yıkandı, hazır" ayrı bir durum yok. Yeni durum eklemek yerine
 * İSTEĞE BAĞLI düğme: halıcı yıkama bitince basar, müşteri "halın hazır,
 * teslimatı bekle" bilgisini alır. SİPARİŞ BAŞINA BİR KEZ (OrderEvent kaydı
 * hem işaret hem geçmiş satırı).
 */
export async function notifyOrderReady(formData: FormData) {
  const b = await getPanelBusiness(); // dükkândaki çalışan da haber verebilmeli
  if (!b) return;
  const orderId = String(formData.get("orderId") ?? "");
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId: b.id, status: "WASHING" },
    select: {
      id: true,
      code: true,
      trackingToken: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
    },
  });
  if (!order) return;
  // Bir kez: daha önce gönderildiyse sessizce çık (çift tık / yenileme).
  const onceki = await prisma.orderEvent.findFirst({
    where: { orderId, note: { startsWith: "Hazır haberi" } },
    select: { id: true },
  });
  if (onceki) {
    revalidatePath(`/panel/siparisler/${orderId}`);
    return;
  }
  await prisma.orderEvent.create({
    data: {
      orderId,
      status: "WASHING",
      note: "Hazır haberi müşteriye gönderildi (yıkama tamamlandı)",
    },
  });
  void waGonderVeKaydet({
    orderId,
    status: "WASHING",
    ownerUserId: b.ownerId,
    etiket: "Hazır haberi",
    metin: "Halınız yıkandı ve teslime hazır.",
    gonder: () =>
      waSiparisHazir(order.customerPhone, order.customerName, b.name, order.code ?? ""),
  });
  if (order.customerEmail) {
    try {
      await sendEmail(
        order.customerEmail,
        `Halın yıkandı, teslime hazır (${order.code ?? ""})`,
        `Halın yıkandı ve teslime hazır. Teslimata çıktığında ayrıca haber vereceğiz. Takip: ${trackingLink(order.trackingToken)}`,
      );
    } catch (e) {
      console.error("[hazir-haberi] e-posta hatası:", e);
    }
  }
  revalidatePath(`/panel/siparisler/${orderId}`);
}
