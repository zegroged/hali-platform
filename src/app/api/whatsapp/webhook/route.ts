import { NextRequest, NextResponse } from "next/server";

// WHATSAPP DURUM WEBHOOK'U (2026-07-29).
//
// NEDEN VAR: Cloud API'de gönderim isteği `accepted` dönse bile mesaj teslim
// EDİLMEYEBİLİR — Meta sebebi yalnız webhook ile bildirir, sorgulanabilir bir
// "durum" ucu YOKTUR. Bu uç açılana kadar sistem kördü: 29 Temmuz'da üç şablon
// `accepted` döndü, hiçbiri telefona ulaşmadı ve sebebini görmenin yolu yoktu.
//
// KURULUM (Meta App Dashboard → WhatsApp → Configuration → Webhook):
//   Callback URL : https://enyakinhaliyikamaservisi.com/api/whatsapp/webhook
//   Verify token : .env'deki WHATSAPP_WEBHOOK_TOKEN ile AYNI değer
//   Abone alanlar: "messages" (durum bildirimleri bu alandan gelir)
// Ardından WABA'ya uygulama aboneliği: POST /{waba-id}/subscribed_apps
//
// ⚠️ İMZA DOĞRULAMASI: Meta her isteğe X-Hub-Signature-256 koyar; doğrulamak
// için uygulama gizli anahtarı (app secret) gerekir ve prod .env'de YOKTUR.
// META_APP_SECRET eklenirse aşağıdaki kontrol kendiliğinden devreye girer.
// O zamana kadar güvenlik yalnız verify token'a dayanır — bu uç hiçbir veri
// SIZDIRMAZ (yalnız log yazar), en kötü ihtimalle sahte log satırı üretilir.

export const dynamic = "force-dynamic";

/** Meta'nın abonelik doğrulaması: hub.challenge'ı aynen geri döndür. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");
  const beklenen = process.env.WHATSAPP_WEBHOOK_TOKEN;

  if (!beklenen) {
    console.error("[whatsapp-webhook] WHATSAPP_WEBHOOK_TOKEN tanımsız");
    return new NextResponse("yapılandırma eksik", { status: 500 });
  }
  if (mode === "subscribe" && token === beklenen && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new NextResponse("doğrulanamadı", { status: 403 });
}

type Durum = {
  id?: string;
  status?: string;
  recipient_id?: string;
  timestamp?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
  conversation?: { id?: string; origin?: { type?: string } };
  pricing?: { billable?: boolean; category?: string };
};

async function imzaGecerliMi(req: NextRequest, ham: string): Promise<boolean> {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true; // anahtar yoksa doğrulama atlanır (yukarıdaki nota bak)
  const imza = req.headers.get("x-hub-signature-256");
  if (!imza?.startsWith("sha256=")) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const beklenen = "sha256=" + createHmac("sha256", secret).update(ham).digest("hex");
  const a = Buffer.from(imza);
  const b = Buffer.from(beklenen);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // Meta 200 ALMAZSA aynı olayı defalarca tekrar gönderir; bu yüzden hata
  // hâlinde bile 200 dönüyoruz, sorunu log'a yazıyoruz.
  const ham = await req.text();
  if (!(await imzaGecerliMi(req, ham))) {
    console.error("[whatsapp-webhook] imza doğrulanamadı — istek yok sayıldı");
    return NextResponse.json({ ok: true });
  }

  try {
    const govde = JSON.parse(ham) as {
      entry?: {
        changes?: {
          value?: {
            statuses?: Durum[];
            messages?: { from?: string; type?: string; text?: { body?: string } }[];
            contacts?: { profile?: { name?: string }; wa_id?: string }[];
          };
        }[];
      }[];
    };
    for (const e of govde.entry ?? []) {
      for (const c of e.changes ?? []) {
        // GELEN MESAJ (2026-07-29): teslim edilemeyen şablonların sebebini
        // ayırmak için eklendi. Numaradan BİZE mesaj düşüyorsa o numaranın
        // WhatsApp'ı sağlamdır ve sorun şablon/gönderim tarafındadır.
        for (const m of c.value?.messages ?? []) {
          const ad = c.value?.contacts?.[0]?.profile?.name ?? "-";
          console.log(
            `[whatsapp-webhook] GELEN MESAJ gonderen=${m.from} ad="${ad}" tur=${m.type} metin="${m.text?.body ?? ""}"`,
          );
        }
        for (const d of c.value?.statuses ?? []) {
          const temel = `id=${d.id} alici=${d.recipient_id} durum=${d.status}`;
          if (d.status === "failed") {
            // ARADIĞIMIZ SATIR BU: teslim edilemeyen mesajın GERÇEK sebebi.
            const h = d.errors?.[0];
            console.error(
              `[whatsapp-webhook] BAŞARISIZ ${temel} kod=${h?.code} baslik="${h?.title}" ayrinti="${h?.error_data?.details ?? h?.message ?? ""}"`,
            );
          } else {
            console.log(
              `[whatsapp-webhook] ${temel} kategori=${d.pricing?.category ?? "-"} faturalanabilir=${d.pricing?.billable ?? "-"}`,
            );
          }
        }
      }
    }
  } catch (e) {
    console.error("[whatsapp-webhook] gövde ayrıştırılamadı:", e);
  }
  return NextResponse.json({ ok: true });
}
