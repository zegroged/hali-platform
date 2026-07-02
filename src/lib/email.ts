// E-posta gönderimi (hesap doğrulama). EMAIL_MODE=live + SMTP anahtarları varsa
// GERÇEK gönderir, yoksa mock (konsola yazar). Herhangi bir SMTP sağlayıcısı
// çalışır: kendi alan adın (info@hali.com), Gmail (uygulama şifresi), Brevo/SendGrid SMTP...
import nodemailer from "nodemailer";

const SITE_URL = "https://enyakinhaliyikamaservisi.com";
const SUPPORT_EMAIL = "info@enyakinhaliyikamaservisi.com";

function transport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true", // 465 → true, 587 → false (STARTTLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Markalı e-posta sarmalayıcı: 600px tablo tabanlı şablon (e-posta istemcileri
 * flex/grid desteklemez, tablo en güvenlisi). Üstte marka şeridi, ortada içerik,
 * altta site linki + destek satırı. İleride tüm e-posta türleri bunu kullanmalı.
 */
export function wrapEmail(contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<body style="margin:0;padding:0;background-color:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
          <tr>
            <td style="background-color:#0f766e;padding:20px 32px;">
              <span style="font-size:18px;font-weight:bold;color:#ffffff;">En Yakın Halı Yıkama</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#0f172a;font-size:15px;line-height:1.6;">
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.6;">
              <a href="${SITE_URL}" style="color:#0f766e;text-decoration:none;font-weight:bold;">enyakinhaliyikamaservisi.com</a><br>
              Sorunuz mu var? <a href="mailto:${SUPPORT_EMAIL}" style="color:#0f766e;">${SUPPORT_EMAIL}</a> adresinden bize ulaşın.<br>
              &copy; 2026 En Yakın Halı Yıkama. Tüm hakları saklıdır.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<void> {
  if (process.env.EMAIL_MODE !== "live") {
    console.log(`\n[MOCK EMAIL] -> ${to}\n${subject}\n${text}\n`);
    return;
  }
  const from =
    process.env.EMAIL_FROM ?? "En Yakın Halı Yıkama <no-reply@enyakinhaliyikamaservisi.com>";
  await transport().sendMail({ from, to, subject, text, html });
}

export async function sendVerificationEmail(
  to: string,
  code: string,
): Promise<void> {
  await sendEmail(
    to,
    "En Yakın Halı Yıkama — E-posta doğrulama kodu",
    // Düz-metin fallback (HTML gösteremeyen istemciler için) korunuyor.
    `Doğrulama kodunuz: ${code}\nKod 10 dakika geçerlidir.`,
    wrapEmail(
      `<p style="margin:0 0 12px;">En Yakın Halı Yıkama hesap doğrulama kodunuz:</p>
       <p style="margin:0 0 12px;font-size:28px;font-weight:bold;letter-spacing:4px;color:#0f766e;">${code}</p>
       <p style="margin:0;color:#64748b;font-size:13px;">Kod 10 dakika geçerlidir. Bu işlemi siz başlatmadıysanız bu e-postayı yok sayın.</p>`,
    ),
  );
}
