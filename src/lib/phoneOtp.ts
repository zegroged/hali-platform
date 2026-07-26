import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizePhone, isRealMobilePhone } from "@/lib/phone";
import { waOtp, whatsappEnabled } from "@/lib/whatsapp";

// TELEFON DOĞRULAMA (2026-07-26) — kod WhatsApp'tan gider.
// NEDEN WHATSAPP: SMS (Netgsm) maliyet nedeniyle ertelendi; WhatsApp'ın
// AUTHENTICATION şablonu Türkiye'de ~25 kuruş ve "Kodu kopyala" butonuyla
// geliyor. WhatsApp KAPALIYKEN doğrulama zorunlu tutulmaz (kayıt akışları
// kırılmasın) — açılınca kendiliğinden devreye girer.

const KOD_SURESI_MS = 10 * 60 * 1000;
const MAX_DENEME = 5;

/** Zamanlama saldırısına kapalı karşılaştırma (kod tahmini yavaşlatılır). */
function esitMi(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function uretKod(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export type OtpSonuc =
  | { ok: true }
  | { ok: false; hata: string; durum?: number };

/** Numaraya doğrulama kodu gönder (WhatsApp). Cep değilse reddeder — sabit
 *  hatta OTP gitmez (işletmelerin sabit hattı bu yüzden ayrı ele alınır). */
export async function telefonKoduGonder(raw: string): Promise<OtpSonuc> {
  const phone = normalizePhone(raw);
  if (!isRealMobilePhone(phone))
    return {
      ok: false,
      hata: "Doğrulama için geçerli bir CEP numarası gerekir (05xx).",
      durum: 400,
    };
  if (!whatsappEnabled)
    return { ok: false, hata: "Doğrulama şu an kapalı.", durum: 503 };

  const code = uretKod();
  await prisma.phoneOtp.upsert({
    where: { phone },
    create: { phone, code, expiresAt: new Date(Date.now() + KOD_SURESI_MS) },
    update: {
      code,
      expiresAt: new Date(Date.now() + KOD_SURESI_MS),
      attempts: 0,
    },
  });
  const r = await waOtp(phone, code);
  if (!r.ok)
    return {
      ok: false,
      hata:
        "Kod gönderilemedi — numaranın WhatsApp'ta kayıtlı olduğundan emin olun.",
      durum: 502,
    };
  return { ok: true };
}

/** Kodu doğrula ve TÜKET. Yanlış denemeler sayılır (5'te kilit). */
export async function telefonKoduDogrula(
  raw: string,
  code: string,
): Promise<OtpSonuc> {
  const phone = normalizePhone(raw);
  const otp = await prisma.phoneOtp.findUnique({ where: { phone } });
  if (!otp || otp.expiresAt < new Date())
    return { ok: false, hata: "Kodun süresi dolmuş — yeni kod isteyin.", durum: 400 };
  if (otp.attempts >= MAX_DENEME)
    return { ok: false, hata: "Çok fazla yanlış deneme — yeni kod isteyin.", durum: 429 };
  if (!esitMi(String(code), otp.code)) {
    await prisma.phoneOtp.update({
      where: { phone },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, hata: "Doğrulama kodu hatalı.", durum: 400 };
  }
  await prisma.phoneOtp.delete({ where: { phone } }).catch(() => {});
  return { ok: true };
}
