// SMS gönderimi. SMS_MODE=live + sağlayıcı anahtarları varsa GERÇEK gönderir,
// yoksa mock (konsola yazar). Sağlayıcı: SMS_PROVIDER=netgsm (TR) | twilio.
// Her gönderim denemesi (mock dahil) SmsLog'a yazılır: bilgilendirme/teyit
// SMS'lerinin İSPATI (Mesafeli Sözleşmeler Yönetmeliği md.20/1-2 — işlem
// kayıtlarının 3 yıl saklanması; kosullar §9'daki kayıt beyanının karşılığı).
import { getAppBaseUrl } from "@/lib/config";
import { prisma } from "@/lib/prisma";

async function sendNetgsm(to: string, body: string) {
  const params = new URLSearchParams({
    usercode: process.env.NETGSM_USERCODE ?? "",
    password: process.env.NETGSM_PASSWORD ?? "",
    gsmno: to.replace(/\D/g, ""),
    message: body,
    msgheader: process.env.NETGSM_HEADER ?? "",
  });
  const res = await fetch(
    "https://api.netgsm.com.tr/sms/send/get?" + params.toString(),
    { signal: AbortSignal.timeout(8000) }, // sağlayıcı takılırsa isteği bloklama
  );
  const text = (await res.text()).trim();
  // Netgsm başarı kodu "00 <id>"; diğerleri hata (20/30/40/70...)
  if (!res.ok || !text.startsWith("00")) {
    throw new Error("Netgsm SMS hatası: " + text);
  }
}

async function sendTwilio(to: string, body: string) {
  const sid = process.env.TWILIO_SID ?? "";
  const token = process.env.TWILIO_TOKEN ?? "";
  const from = process.env.TWILIO_FROM ?? "";
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!res.ok) throw new Error("Twilio SMS hatası: " + (await res.text()));
}

// Delil kaydı: DB yazımı başarısız olsa bile SMS akışını BOZMAZ (yalnız loglar) —
// sendSms'in hata fırlatma düzeni değişmesin diye kendi içinde yutulur.
async function logSms(to: string, body: string, ok: boolean, error?: string) {
  try {
    await prisma.smsLog.create({
      data: { to, body, ok, error: error ?? null },
    });
  } catch (e) {
    console.error("SmsLog yazılamadı:", e);
  }
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (process.env.SMS_MODE !== "live") {
    console.log(`\n[MOCK SMS] -> ${to}\n${body}\n`);
    // Mock modda da ok=true loglanır: geliştirme/test dönemindeki teyitlerin
    // de izi kalsın (Yön. md.20/2 — aracı hizmet sağlayıcının işlem kayıtları).
    await logSms(to, body, true);
    return;
  }
  const provider = (process.env.SMS_PROVIDER ?? "netgsm").toLowerCase();
  try {
    if (provider === "twilio") await sendTwilio(to, body);
    else await sendNetgsm(to, body);
  } catch (e) {
    await logSms(to, body, false, e instanceof Error ? e.message : String(e));
    throw e; // mevcut davranış: hata çağırana aynen fırlatılır
  }
  await logSms(to, body, true);
}

export function trackingLink(token: string): string {
  return `${getAppBaseUrl()}/takip/${token}`;
}

export async function sendTrackingSms(
  to: string,
  customerName: string,
  token: string,
): Promise<void> {
  // ASCII bırakıldı (Türkçe karakter SMS'i UCS-2'ye düşürüp krediyi katlar).
  // "Siparisiniz alindi" → 6563 Yön. md.9 teyidi; "Sozlesme ve cayma bilgileri
  // takip sayfanizdadir" → Mesafeli Yön. md.10 ispatı (SMS kalıcı veri
  // saklayıcısıdır, md.4/1-c) — cayma bilgilendirmesinin SMS ile de iletilmesi.
  await sendSms(
    to,
    `Merhaba ${customerName}, siparisiniz alindi. Sozlesme ve cayma bilgileri takip sayfanizdadir. Takip: ${trackingLink(token)}`,
  );
}
