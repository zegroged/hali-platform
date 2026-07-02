// E-posta gönderimi (hesap doğrulama). EMAIL_MODE=live + SMTP anahtarları varsa
// GERÇEK gönderir, yoksa mock (konsola yazar). Herhangi bir SMTP sağlayıcısı
// çalışır: kendi alan adın (info@hali.com), Gmail (uygulama şifresi), Brevo/SendGrid SMTP...
import nodemailer from "nodemailer";

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
    `Doğrulama kodunuz: ${code}\nKod 10 dakika geçerlidir.`,
    `<div style="font-family:sans-serif">
       <p>En Yakın Halı Yıkama hesap doğrulama kodunuz:</p>
       <p style="font-size:24px;font-weight:bold;letter-spacing:2px">${code}</p>
       <p style="color:#666">Kod 10 dakika geçerlidir. Bu işlemi siz başlatmadıysanız yok sayın.</p>
     </div>`,
  );
}
