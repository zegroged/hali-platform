// SMS gönderimi. SMS_MODE=live + sağlayıcı anahtarları varsa GERÇEK gönderir,
// yoksa mock (konsola yazar). Sağlayıcı: SMS_PROVIDER=netgsm (TR) | twilio.
import { getAppBaseUrl } from "@/lib/config";

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
    },
  );
  if (!res.ok) throw new Error("Twilio SMS hatası: " + (await res.text()));
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (process.env.SMS_MODE !== "live") {
    console.log(`\n[MOCK SMS] -> ${to}\n${body}\n`);
    return;
  }
  const provider = (process.env.SMS_PROVIDER ?? "netgsm").toLowerCase();
  if (provider === "twilio") return sendTwilio(to, body);
  return sendNetgsm(to, body);
}

export function trackingLink(token: string): string {
  return `${getAppBaseUrl()}/takip/${token}`;
}

export async function sendTrackingSms(
  to: string,
  customerName: string,
  token: string,
): Promise<void> {
  await sendSms(
    to,
    `Merhaba ${customerName}, halı talebiniz alındı. Takip: ${trackingLink(token)}`,
  );
}
