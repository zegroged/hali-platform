"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeCarpetCount, CARPET_COUNT_HATA } from "@/lib/carpet";
import { hataylaDon } from "@/lib/hata";
import {
  bildirAraAdim,
  bildirTeslimEdildi,
  bildirMusteriyeEposta,
} from "@/lib/orderNotify";
import { parseTutar } from "@/lib/money";
import { getSessionUser } from "@/lib/auth";
import { sendSms, trackingLink } from "@/lib/sms";
import { waSiparisYolda, waGonderVeKaydet } from "@/lib/whatsapp";
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
  // "ALIM": fotoğraf aşamaya bağlanır (driverOrders.ts ile İKİZ) → müşteri
  // takip sayfasındaki galeride "Alım" etiketiyle görünür.
  const photoUrl = await saveOrderPhotoFile(
    formData.get("photo"),
    o.businessId,
    o.id,
    "ALIM",
  );
  // 🔴 2026-08-08: burada SESSİZ `redirect("/sofor")` vardı. Arayüz yalnız
  // "dosya seçildi mi"ye bakıyor; `saveOrderPhotoFile` bunun dışında da null
  // dönebiliyor (8 MB üstü, HEIC/desteklenmeyen tür, sharp hatası). O
  // durumlarda şoför aynı ekrana atılıyor ve NEDEN olmadığını hiç öğrenmiyordu.
  // Mobil ikizi (`lib/driverOrders.ts`) sebebini yazıyor; beş satır aşağıdaki
  // carpetCount dalı da `hataylaDon` kullanıyor — yalnız bu dal susuyordu.
  if (!photoUrl)
    hataylaDon(
      "/sofor",
      "Fotoğraf kaydedilemedi (jpg/png/webp, en fazla 8 MB). Tekrar çek ya da başka bir kare dene — fotoğraf olmadan halı alınmış sayılmaz.",
    );

  // HALI SAYISI — ALIM ANINDA (2026-08-06, driverOrders.ts ile İKİZ).
  // Numaralar buradan doğar; öncesinde fotoğraftan doğuyordu ve fotoğrafı
  // çekilmeyen halı sistemde hiç yoktu (bkz. lib/carpet.ts).
  const sayi = normalizeCarpetCount(formData.get("carpetCount"));
  if (sayi === "gecersiz") hataylaDon("/sofor", CARPET_COUNT_HATA);

  // CAS (denetim bulgusu): koşulsuz yazım, eşzamanlı panel iptali/reddini
  // (ACCEPTED→CANCELED/REJECTED) ezip siparişi PICKED_UP'a diriltiyordu.
  const picked = await prisma.order.updateMany({
    where: { id, driverId: d.id, status: "ACCEPTED" },
    data: {
      status: "PICKED_UP",
      pickedUpAt: new Date(), // İKİZ: lib/driverOrders.ts (2026-08-07 akşam)
      pickupPhotoUrl: photoUrl,
      ...(sayi != null ? { carpetCount: sayi } : {}),
    },
  });
  if (picked.count === 0) return; // yarış: durum değişti → yazma, yan etki yok
  await prisma.orderEvent.create({
    data: { orderId: id, status: "PICKED_UP", note: "Halı alındı" },
  });
  // "Halın teslim alındı" bildirimi — panel ve şoför uygulamasıyla İKİZ.
  await bildirAraAdim(id, "alindi");
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

  // 🔴 KESİN FİYAT ZORUNLU (2026-08-02) — panel/actions ve driverOrders ile İKİZ.
  // Şoför fiyatı giremez; işletme paneli girer. Bu yüzden mesaj şoförü
  // işletmeye yönlendirir. Sessizce dönmek yerine görünür hata: şoför neden
  // ilerleyemediğini bilmeli.
  if (o.status === "PICKED_UP" && next === "WASHING" && o.quotedPrice == null) {
    hataylaDon(
      "/sofor",
      "Yıkamaya geçilemez: işletme henüz kesin fiyatı bildirmedi. İşletmeye haber ver, panelden tutarı girsin.",
    );
  }

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

  // "Yıkanmaya başladı" bildirimi — panel ve şoför uygulamasıyla İKİZ.
  if (next === "WASHING") {
    await bildirAraAdim(id, "yikama");
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
        // "Canli takip" TUTULAMAYAN bir vaatti (2026-08-10): şoförün konumu
        // arka planda ~6,5 dk sonra kesiliyor (Tecno/HiOS) ve web şoför
        // sayfası telefon kilitlenince duruyor — harita donmuş bir nokta
        // gösterebiliyor. Söz verilen şey artık TUTULABİLEN şey: sipariş takibi.
        `Haliniz yola cikti! Siparis takibi: ${trackingLink(o.trackingToken)}`,
      );
    } catch (e) {
      console.error("advanceOrder SMS hatası:", e);
    }
    // WhatsApp — panel/actions.ts ile İKİZ (2026-07-27 denetim bulgusu).
    // Mesajda işletme adı geçer; gitmezse sahibine zil çalar (müşteriyi arasın).
    const isletme = await prisma.cleanerBusiness.findUnique({
      where: { id: o.businessId },
      select: { name: true, ownerId: true },
    });
    void waGonderVeKaydet({
      orderId: o.id,
      status: "OUT_FOR_DELIVERY",
      ownerUserId: isletme?.ownerId ?? null,
      etiket: "Teslimat bilgisi",
      metin: "Halınız teslimata çıktı, şoförümüz yolda.",
      gonder: () =>
        waSiparisYolda(
          o.customerPhone,
          o.customerName,
          isletme?.name ?? "",
          o.code ?? "",
          o.trackingToken,
        ),
    });
    // E-posta da gitsin (2026-07-28) — üç akışta da aynı olsun.
    await bildirMusteriyeEposta(id, "yolda");
  }
  revalidatePath("/sofor");
}

// Teslim anında tahsilat — Türk usulü: önce iş görülür, sonra ödeme alınır.
// NAKİT: teslimde tahsil → PAID. KART: tutar belirlenir, müşteri iyzico ile öder
// (init→callback PAID yapar); burada kart ÇEKİLMEZ (server-side kart çekimi yok).
export async function deliverOrder(formData: FormData) {
  const d = await currentDriver();
  const id = String(formData.get("orderId"));
  const price = parseTutar(formData.get("price"));

  // Geçersiz/sıfır/negatif tutar sessizce yutulmasın → şoför net hata görsün.
  if (!Number.isFinite(price) || price <= 0) {
    hataylaDon("/sofor", "Geçerli bir teslim tutarı girin (0'dan büyük bir tutar).");
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
    "TESLIM",
  );
  // 🔴 2026-08-08: alım dalıyla AYNI sessizlik buradaydı. Teslimde daha da
  // kritik: fotoğraf yoksa DELIVERED olmaz, yani tahsilat kaydı da açılmaz —
  // şoför parayı almış ama sistemde teslim görünmüyor olabilir.
  if (!deliveryPhotoUrl)
    hataylaDon(
      "/sofor",
      "Teslim fotoğrafı kaydedilemedi (jpg/png/webp, en fazla 8 MB). Tekrar çek — fotoğraf olmadan teslim ve tahsilat kaydı açılmaz.",
    );

  const isCash = o.paymentMethod === "CASH";
  // Nakitte teslimde tahsil edilir; kartta ödeme iyzico callback'ine bırakılır.
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
  const paymentStatus = tahsilEdildi ? "PAID" : o.paymentStatus;

  // CAS: yalnız hâlâ OUT_FOR_DELIVERY ise güncelle → çift tık / çift teslim engeli.
  const updated = await prisma.order.updateMany({
    where: { id, status: "OUT_FOR_DELIVERY" },
    data: {
      status: "DELIVERED",
      priceTotal: price,
      deliveredAt: new Date(),
      deliveryPhotoUrl,
      // Komisyon yalnız tahsilat gerçekleşince yazılır: nakit→şimdi (0),
      // kart→callback'te PAID ile birlikte (B6, çift-yazım yok).
      commission: isCash ? 0 : undefined,
      paymentStatus,
      collectedAmount: tahsilEdildi ? price : undefined,
      collectedAt: tahsilEdildi ? new Date() : undefined,
      collectedById: tahsilEdildi ? d.userId : undefined,
      collectedMethod: tahsilEdildi ? yontem : undefined,
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
  await bildirTeslimEdildi(id);
  revalidatePath("/sofor");
}
