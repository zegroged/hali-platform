// KESİN FİYAT ONAYI — TEK KAYNAK (2026-08-07 akşam).
//
// NEDEN AYRI DOSYA: onay artık İKİ yoldan gelebiliyor —
//   (a) müşteri takip sayfasındaki "Fiyatı Onayla" düğmesine basar
//   (b) müşteri WhatsApp'taki "Onaylıyorum" düğmesine basar (4.70)
// Aynı işi iki yerde yazmak bu depodaki en pahalı hata deseni ("İKİZ
// mantıklar", DEVIR §7): biri düzelir, öteki sessizce bayatlar. Burada tek
// kopya var; iki yol da bunu çağırır.
//
// HUKUKİ AĞIRLIK (Mesafeli Sözleşmeler Yönetmeliği md.15/1-h): onay,
// ifaya (yıkamaya) başlama iznidir ve cayma hakkını etkiler. Bu yüzden:
//  · Onay ANINDAKİ tutar kilitlenip kayda yazılır (arada fiyat değişmiş olabilir).
//  · Onayın NEREDEN geldiği (`kaynak`) sipariş geçmişine yazılır — uyuşmazlıkta
//    "müşteri neyi, nereden onayladı" sorusunun cevabı budur.

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendSms } from "@/lib/sms";

export type OnaySonuc =
  | { ok: true; zatenOnayli?: boolean; tutar: number }
  | { ok: false; hata: string; durum: number };

/**
 * @param kaynak  Kayda yazılacak kanal adı — "takip sayfası" / "WhatsApp düğmesi".
 * @param iz      Varsa kanıt kimliği (WhatsApp mesaj kimliği gibi).
 */
export async function fiyatiOnayla(
  orderId: string,
  kaynak: string,
  iz?: string,
): Promise<OnaySonuc> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      quotedPrice: true,
      priceApprovedAt: true,
      business: { select: { phone: true, ownerId: true } },
    },
  });
  if (!order) return { ok: false, hata: "Sipariş bulunamadı.", durum: 404 };
  if (order.quotedPrice == null)
    return {
      ok: false,
      hata: "Onaylanacak bir kesin fiyat bildirimi bulunmuyor.",
      durum: 409,
    };

  // CAS: yalnız PICKED_UP + fiyat bildirilmiş + henüz onaylanmamışken yaz —
  // çift tık / yarış durumunda ikinci istek koşula takılır.
  const approved = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: "PICKED_UP",
      quotedPrice: { not: null },
      priceApprovedAt: null,
    },
    data: { priceApprovedAt: new Date() },
  });
  if (approved.count === 0) {
    if (order.priceApprovedAt != null)
      return { ok: true, zatenOnayli: true, tutar: Number(order.quotedPrice) };
    return {
      ok: false,
      hata: "Fiyat onayı şu anda yapılamıyor. Sayfayı yenileyip tekrar deneyin.",
      durum: 409,
    };
  }

  // İspat kaydındaki tutar, onay ANINDA kilitlenen fiyat olsun (okuma ile CAS
  // arasında işletme fiyatı güncellemiş olabilir) → taze oku.
  const locked = await prisma.order.findUnique({
    where: { id: order.id },
    select: { quotedPrice: true },
  });
  const tutar = Number(locked?.quotedPrice ?? order.quotedPrice);

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      status: "PICKED_UP", // durum değişmez; onay kaydı düşülür
      note:
        `Müşteri kesin fiyatı onayladı: ${tutar} TL — yıkamaya başlama izni verildi` +
        ` (${kaynak}${iz ? `, kayıt: ${iz}` : ""})`,
    },
  });

  // İşletme onay gelmeden yıkamaya başlayamıyor — panel yenilemesine muhtaç
  // bırakma, haber ver.
  await notify({
    userId: order.business.ownerId,
    type: "fiyat-onay",
    title: "Müşteri kesin fiyatı onayladı",
    body: `${order.code ?? ""} · ${tutar} TL — yıkamaya başlayabilirsiniz`,
    href: "/panel/siparisler",
  });
  try {
    await sendSms(
      order.business.phone,
      `Musteri kesin fiyati ONAYLADI (${order.code ?? ""}, ${tutar} TL). Yikamaya baslayabilirsiniz.`,
    );
  } catch (e) {
    console.error("fiyatiOnayla işletme SMS hatası:", e);
  }

  return { ok: true, tutar };
}
