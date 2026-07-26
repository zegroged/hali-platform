import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import type { OrderStatus } from "@prisma/client";

// WHATSAPP CLOUD API (2026-07-26) — sipariş bildirimlerinin ASIL kanalı.
// SMS pahalı olduğu için ertelenmişti; WhatsApp "utility" şablonu Türkiye'de
// mesaj başına ~3 kuruş. Mesajlar BİZİM numaramızdan gider, metinde işletme
// adı geçer ("Hijyen Halı Yıkama işletmesindeki halınız...").
//
// AÇILMA KOŞULU: WHATSAPP_TOKEN + WHATSAPP_PHONE_ID tanımlıysa çalışır; yoksa
// sessizce devre dışıdır (mevcut e-posta/zil kanalları etkilenmez).
// Meta kuralı: şablon dışı serbest metin ancak müşteri son 24 saatte bize
// yazdıysa gönderilebilir — o yüzden HER ŞEY onaylı şablonla gider.

const GRAPH = "https://graph.facebook.com/v21.0";

export const whatsappEnabled =
  Boolean(process.env.WHATSAPP_TOKEN) && Boolean(process.env.WHATSAPP_PHONE_ID);

/** TR numarasını Meta'nın beklediği biçime çevir (905321112233). */
export function waNumber(raw: string): string | null {
  const d = normalizePhone(raw); // 0XXXXXXXXXX
  if (!/^0[2-5]\d{9}$/.test(d)) return null;
  return "90" + d.slice(1);
}

type SonucKaydi = { ok: boolean; id?: string; error?: string };

/** Onaylı şablonu gönder. Best-effort: hata ASLA sipariş akışını bozmaz. */
export async function sendTemplate(
  to: string,
  template: string,
  params: string[],
): Promise<SonucKaydi> {
  if (!whatsappEnabled) return { ok: false, error: "whatsapp kapalı" };
  const num = waNumber(to);
  if (!num) return { ok: false, error: "geçersiz numara" };

  try {
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: num,
        type: "template",
        template: {
          name: template,
          language: { code: "tr" },
          components: params.length
            ? [
                {
                  type: "body",
                  parameters: params.map((p) => ({ type: "text", text: p })),
                },
              ]
            : [],
        },
      }),
      // Ağ takılırsa sipariş akışı beklemesin.
      signal: AbortSignal.timeout(12000),
    });
    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };
    if (!res.ok || data.error) {
      return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "bilinmeyen hata" };
  }
}

/** GÖNDER + İŞLETMEYE BİLDİR (2026-07-26 kullanıcı isteği):
 *  - Başarılı: sipariş geçmişine "WhatsApp'tan gönderildi" satırı düşer
 *    (panelde sipariş detayında görünür; her mesaj için zil çalmak gürültü olurdu).
 *  - Başarısız: işletme sahibine ZİL — müşteriye ulaşılamadı, telefonla arasın.
 *  Tamamen best-effort: hiçbir hata sipariş akışını bozmaz. */
export async function waGonderVeKaydet(opts: {
  orderId: string;
  status: OrderStatus;
  ownerUserId?: string | null;
  etiket: string; // "Takip kodu", "Fiyat onayı", "Teslimat bilgisi"
  gonder: () => Promise<SonucKaydi>;
}): Promise<void> {
  if (!whatsappEnabled) return; // kapalıyken iz bırakma
  const r = await opts.gonder();
  try {
    if (r.ok) {
      await prisma.orderEvent.create({
        data: {
          orderId: opts.orderId,
          status: opts.status,
          note: `${opts.etiket} müşteriye WhatsApp'tan gönderildi`,
        },
      });
      return;
    }
    await prisma.orderEvent.create({
      data: {
        orderId: opts.orderId,
        status: opts.status,
        note: `WhatsApp gönderilemedi (${opts.etiket}): ${r.error ?? "bilinmeyen"}`,
      },
    });
    if (opts.ownerUserId) {
      await notify({
        userId: opts.ownerUserId,
        type: "genel",
        title: "WhatsApp mesajı gitmedi",
        body: `${opts.etiket} müşteriye ulaşmadı — telefonla bilgilendirmen gerekebilir.`,
        href: `/panel/siparisler/${opts.orderId}`,
      });
    }
  } catch (e) {
    console.error("whatsapp kayıt:", e);
  }
}

// ---- Sipariş olaylarına karşılık gelen yardımcılar ----
// Şablon adları Meta'da onaylıdır; değişken SIRASI şablonla birebir aynı olmalı.

/** Sipariş oluşturuldu: müşteri adı, işletme adı, takip kodu. */
export function waSiparisAlindi(to: string, ad: string, isletme: string, kod: string) {
  return sendTemplate(to, "siparis_alindi", [ad, isletme, kod]);
}

/** Kesin fiyat girildi, müşteri onayı bekleniyor (tutar takip sayfasında). */
export function waFiyatOnayi(to: string, ad: string, isletme: string, kod: string) {
  return sendTemplate(to, "fiyat_onayi_bekleniyor", [ad, isletme, kod]);
}

/** Yıkama bitti, teslime hazır. */
export function waSiparisHazir(to: string, ad: string, isletme: string, kod: string) {
  return sendTemplate(to, "siparis_hazir", [ad, isletme, kod]);
}

/** Teslimata çıktı. */
export function waSiparisYolda(to: string, ad: string, isletme: string, kod: string) {
  return sendTemplate(to, "siparis_yolda", [ad, isletme, kod]);
}

/** TELEFON DOĞRULAMA KODU (2026-07-26): SMS pahalı olduğu için OTP de
 *  WhatsApp'tan gider. Meta'nın AUTHENTICATION şablonu özel biçimlidir: gövde
 *  metnini Meta üretir, biz yalnız KODU veririz; kod hem gövdede hem "Kodu
 *  kopyala" butonunda geçtiği için iki yerde de parametre olarak gönderilir.
 *  Türkiye tarifesi: kimlik doğrulama mesajı ~0,005 $ (~25 kuruş) — SMS'in
 *  yarısı. Şablon adı: dogrulama_kodu (kalıcı jetonla oluşturulacak). */
export async function waOtp(to: string, code: string): Promise<SonucKaydi> {
  if (!whatsappEnabled) return { ok: false, error: "whatsapp kapalı" };
  const num = waNumber(to);
  if (!num) return { ok: false, error: "geçersiz numara" };
  try {
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: num,
        type: "template",
        template: {
          name: "dogrulama_kodu",
          language: { code: "tr" },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: code }],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(12000),
    });
    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };
    if (!res.ok || data.error)
      return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, id: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "bilinmeyen hata" };
  }
}
