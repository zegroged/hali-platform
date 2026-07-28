import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendEmail, wrapEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/config";
import {
  waGonderVeKaydet,
  waSiparisIptal,
  waSiparisTeslim,
} from "@/lib/whatsapp";

// SİPARİŞ KESİNTİ BİLDİRİMLERİ (2026-07-28 denetim — KRİTİK bulgular).
//
// SORUN: red / iptal yollarının hepsi YALNIZ `sendSms` çağırıyordu. SMS bu
// projede MOCK (Netgsm maliyet nedeniyle ertelendi, DEVIR §0) — yani hiçbir
// bildirim gitmiyordu. Somut sonuçları:
//   - Halıcı siparişi reddedince/iptal edince MÜŞTERİ hiç öğrenmiyordu; evde
//     halının alınmasını bekliyordu. Oysa elimizde ZORUNLU e-posta var.
//   - Müşteri iptal edince İŞLETME ve ŞOFÖR haber almıyordu; şoför halıyı
//     almaya gidiyordu.
//
// Bu modül üç kanalı birden kullanır: uygulama-içi zil (asıl kanal),
// e-posta (canlı), WhatsApp (açıldığında). Hiçbir hata çağıran akışı bozmaz.

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Kesinti = {
  orderId: string;
  /** "red" = halıcı talebi reddetti · "iptal" = sipariş iptal edildi */
  tur: "red" | "iptal";
  /** Kim iptal etti — mesajın dili buna göre değişir. */
  kaynak: "isletme" | "musteri";
  sebep?: string | null;
  /** Halı alınmış mıydı? (iade sözü verilmeli mi) */
  aliniMisti?: boolean;
};

/**
 * Sipariş kesintisini İLGİLİ HERKESE duyur.
 * - İşletme kaynaklıysa → müşteriye (e-posta + WhatsApp)
 * - Müşteri kaynaklıysa → işletme sahibine + atanmış şoföre (zil) ve müşteriye teyit
 */
export async function bildirSiparisKesintisi(o: Kesinti): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: o.orderId },
      select: {
        id: true,
        code: true,
        trackingToken: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        driverId: true,
        business: {
          select: { name: true, phone: true, ownerId: true },
        },
        driver: { select: { userId: true } },
      },
    });
    if (!order) return;

    const kod = order.code ?? order.trackingToken;
    const base = getAppBaseUrl();
    const sebepMetin = o.sebep ? ` Sebep: ${o.sebep}` : "";

    if (o.kaynak === "isletme") {
      // ---- MÜŞTERİYE: talebin karşılanmadı / siparişin iptal edildi ----
      if (order.customerEmail) {
        const baslik =
          o.tur === "red"
            ? "Talebin maalesef karşılanamadı"
            : "Siparişin iptal edildi";
        const govde =
          o.tur === "red"
            ? `${order.business.name} talebini karşılayamadı.${sebepMetin} Başka bir halıcı seçebilirsin.`
            : `${order.business.name} siparişini iptal etti.${sebepMetin}` +
              (o.aliniMisti
                ? " Halın yıkanmadan adresine iade edilecek, ücret talep edilmez."
                : "");
        await sendEmail(
          order.customerEmail,
          `${baslik} — ${kod}`,
          `${govde} Sipariş kodu: ${kod}. Halıcının telefonu: ${order.business.phone}`,
          wrapEmail(
            `<p style="margin:0 0 12px;">Merhaba ${esc(order.customerName)},</p>
             <p style="margin:0 0 12px;">${esc(govde)}</p>
             <p style="margin:0 0 12px;">Sipariş kodun: <strong>${esc(kod)}</strong></p>
             <p style="margin:0 0 16px;"><a href="${base}/halicilar" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">Yakınındaki diğer halıcılar</a></p>
             <p style="margin:0;color:#64748b;font-size:13px;">Halıcıya ulaşmak istersen: ${esc(order.business.phone)}</p>`,
          ),
        );
      }
      // WhatsApp da gitsin (2026-07-28 kullanıcı isteği: "e-posta ve whatsapp
      // olsun hepsinde"). Sebep şablona girmiyor — Meta serbest metni pazarlama
      // sayıyor; ayrıntı e-postada ve takip sayfasında.
      await waGonderVeKaydet({
        orderId: order.id,
        status: o.tur === "red" ? "REJECTED" : "CANCELED",
        ownerUserId: null,
        etiket: o.tur === "red" ? "Red bildirimi" : "İptal bildirimi",
        gonder: () =>
          waSiparisIptal(
            order.customerPhone,
            order.customerName,
            order.business.name,
            kod,
          ),
      });
      return;
    }

    // ---- MÜŞTERİ İPTAL ETTİ → İŞLETME + ŞOFÖR ZİLİ ----
    // Şoför halıyı almaya gitmesin diye bu bildirim ŞART.
    const baslik = "Müşteri siparişi iptal etti";
    const govde = `${kod} kodlu siparişi müşteri iptal etti.${sebepMetin}`;
    if (order.business.ownerId) {
      await notify({
        userId: order.business.ownerId,
        type: "iptal",
        title: baslik,
        body: govde,
        href: `/panel/siparisler/${order.id}`,
      });
    }
    if (order.driver?.userId) {
      await notify({
        userId: order.driver.userId,
        type: "iptal",
        title: baslik,
        body: `${govde} Bu adrese gitme.`,
        href: `/sofor`,
      });
    }
  } catch (e) {
    // Bildirim hiçbir zaman iptali/reddi bozmaz — durum zaten yazıldı.
    console.error("[siparis-kesinti] bildirim hatası:", e);
  }
}


/**
 * SİPARİŞ TESLİM EDİLDİ — müşteriye teyit + değerlendirme daveti (2026-07-28).
 *
 * Teslim, müşteri için işin BİTTİĞİ an; o zamana kadar hiçbir kapanış mesajı
 * gitmiyordu. Hem "işlem tamam" teyidi hem de yorum daveti buradan gider —
 * yorumlar sistemin güven mekanizmasının temeli (yalnız teslim edilmiş siparişi
 * olan üye yorum yazabiliyor).
 */
export async function bildirTeslimEdildi(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        trackingToken: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        business: { select: { name: true, ownerId: true } },
      },
    });
    if (!order) return;
    const kod = order.code ?? order.trackingToken;
    const url = `${getAppBaseUrl()}/takip/${order.trackingToken}`;

    if (order.customerEmail) {
      await sendEmail(
        order.customerEmail,
        `Halın teslim edildi — ${kod}`,
        `${order.business.name} halını teslim etti. Sipariş kodun: ${kod}. Değerlendirme bırakmak için: ${url}`,
        wrapEmail(
          `<p style="margin:0 0 12px;">Merhaba ${esc(order.customerName)},</p>
           <p style="margin:0 0 12px;"><strong>${esc(order.business.name)}</strong> halını teslim etti. İşlemin tamamlandı.</p>
           <p style="margin:0 0 12px;">Sipariş kodun: <strong>${esc(kod)}</strong></p>
           <p style="margin:0 0 16px;">Memnun kaldıysan birkaç saniyeni ayırıp değerlendirme bırakır mısın? Yorumun, senden sonra gelen müşterilere yol gösteriyor.</p>
           <p style="margin:0 0 16px;"><a href="${url}" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">Değerlendirme bırak</a></p>
           <p style="margin:0;color:#64748b;font-size:13px;">Bir sorun olduysa doğrudan halıcıya ulaşabilir ya da bize yazabilirsin.</p>`,
        ),
      );
    }

    await waGonderVeKaydet({
      orderId: order.id,
      status: "DELIVERED",
      ownerUserId: order.business.ownerId ?? null,
      etiket: "Teslim bildirimi",
      gonder: () =>
        waSiparisTeslim(
          order.customerPhone,
          order.customerName,
          order.business.name,
          kod,
        ),
    });
  } catch (e) {
    console.error("[teslim-bildirimi] hata:", e);
  }
}


/**
 * FİYAT ONAYI BEKLENİYOR / HALI YOLDA — e-posta tarafı (2026-07-28).
 *
 * Bu iki olayda WhatsApp vardı ama e-POSTA YOKTU; WhatsApp kapalıyken (ki hâlâ
 * öyleydi) müşteriye hiçbir şey ulaşmıyordu. Özellikle FİYAT ONAYI kritik:
 * müşteri onaylamadan yıkama başlamıyor, yani haberi olmazsa sipariş askıda
 * kalıyor. Kullanıcı isteği: "e-posta ve whatsapp olsun hepsinde".
 */
export async function bildirMusteriyeEposta(
  orderId: string,
  olay: "fiyat-onayi" | "yolda",
): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        code: true,
        trackingToken: true,
        customerName: true,
        customerEmail: true,
        business: { select: { name: true, phone: true } },
      },
    });
    if (!order?.customerEmail) return;
    const kod = order.code ?? order.trackingToken;
    const url = `${getAppBaseUrl()}/takip/${order.trackingToken}`;

    const icerik =
      olay === "fiyat-onayi"
        ? {
            konu: `Kesin fiyatın hazır — onayını bekliyoruz (${kod})`,
            duz: `${order.business.name} halını ölçtü ve kesin fiyatı bildirdi. Onaylamadan yıkama başlamaz. Tutarı görmek ve onaylamak için: ${url}`,
            html: `<p style="margin:0 0 12px;">Merhaba ${esc(order.customerName)},</p>
              <p style="margin:0 0 12px;"><strong>${esc(order.business.name)}</strong> halını ölçtü ve kesin fiyatı bildirdi.</p>
              <p style="margin:0 0 16px;"><strong>Onaylamadan yıkama başlamaz.</strong> Tutarı beğenmezsen halın yıkanmadan, ücretsiz geri getirilir.</p>
              <p style="margin:0 0 16px;"><a href="${url}" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">Fiyatı gör ve onayla</a></p>`,
            etiket: "Fiyat onayı",
          }
        : {
            konu: `Halın yola çıktı (${kod})`,
            duz: `${order.business.name} halını teslimata çıkardı. Şoförü haritada canlı izleyebilirsin: ${url}`,
            html: `<p style="margin:0 0 12px;">Merhaba ${esc(order.customerName)},</p>
              <p style="margin:0 0 12px;"><strong>${esc(order.business.name)}</strong> halını teslimata çıkardı.</p>
              <p style="margin:0 0 16px;">Şoförü haritada canlı izleyebilirsin. Ödeme teslimde yapılır.</p>
              <p style="margin:0 0 16px;"><a href="${url}" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">Şoförü canlı takip et</a></p>`,
            etiket: "Teslimat bilgisi",
          };

    await sendEmail(
      order.customerEmail,
      icerik.konu,
      icerik.duz,
      wrapEmail(
        icerik.html +
          `<p style="margin:0;color:#64748b;font-size:13px;">Sipariş kodun: ${esc(kod)} · Halıcı: ${esc(order.business.phone)}</p>`,
      ),
    );
  } catch (e) {
    console.error("[musteri-eposta] hata:", e);
  }
}
