// Merkezi ortam-değişkeni doğrulaması.
// Amaç: eksik/zayıf/placeholder değerlerle SESSİZCE yanlış çalışmak yerine
// (ödeme alınmadan PAID, oturum sahteciliği, kırık SMS linkleri) başlangıçta
// NET bir hatayla durmak. Build sırasında atlanır (build env'inde sırlar olmaz).

const isProd = process.env.NODE_ENV === "production";
const isBuild = process.env.NEXT_PHASE === "phase-production-build";

const PLACEHOLDER = /dev-secret|degistir|change-me|placeholder|buraya/i;

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Eksik ortam değişkeni: ${name} (üretim için zorunlu).`);
  }
  return v;
}

/** Oturum imzası (web cookie + native Bearer token). Üretimde güçlü olmalı. */
export function getSessionSecret(): string {
  const v = process.env.SESSION_SECRET ?? "";
  const weak = v.length < 32 || PLACEHOLDER.test(v);
  if (isProd && !isBuild && weak) {
    throw new Error(
      "SESSION_SECRET üretimde zorunlu: en az 32 rastgele karakter, placeholder olamaz.\n" +
        'Üret: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  // geliştirme: ne varsa onu kullan (yoksa yalnız-dev sabiti)
  return v || "dev-only-insecure-secret-please-set-SESSION_SECRET";
}

/** SMS takip linki + iyzico callback tabanı. Üretimde https, localhost olamaz. */
export function getAppBaseUrl(): string {
  const v = process.env.APP_BASE_URL ?? "";
  if (!v) {
    if (isProd && !isBuild) {
      throw new Error("APP_BASE_URL üretimde zorunlu (örn. https://halı.com).");
    }
    return "http://localhost:3000";
  }
  if (isProd && !isBuild && v.includes("localhost")) {
    throw new Error("APP_BASE_URL üretimde localhost olamaz.");
  }
  return v;
}

export const paymentsLive = process.env.PAYMENTS_MODE === "live";
export const smsLive = process.env.SMS_MODE === "live";
export const emailLive = process.env.EMAIL_MODE === "live";
// SOFT-LAUNCH: sağlayıcılar (Netgsm/Brevo) henüz kurulmadıysa üretimde mock
// SMS/e-postaya izin ver. Sağlayıcılar kurulunca bu bayrağı KALDIR.
export const mockNotifyAllowed = process.env.ALLOW_MOCK_NOTIFY === "1";

/** iyzico API tabanı; canlı modda sandbox'a düşmesini engelle. */
export function getIyzicoBaseUrl(): string {
  const v = process.env.IYZICO_BASE_URL ?? "https://sandbox-api.iyzipay.com";
  if (paymentsLive && isProd && !isBuild && v.includes("sandbox")) {
    throw new Error(
      "PAYMENTS_MODE=live: IYZICO_BASE_URL üretimde sandbox olamaz (https://api.iyzipay.com).",
    );
  }
  return v;
}

let validated = false;

/** Tüm kritik yapılandırmayı doğrula. Bir kez çalışır; build'de atlanır. */
export function validateConfig(): void {
  if (validated || isBuild) return;

  // her ortamda gerekli
  required("DATABASE_URL");
  getSessionSecret();
  getAppBaseUrl();

  // iyzico canlıysa anahtarlar + doğru taban zorunlu
  if (paymentsLive) {
    required("IYZICO_API_KEY");
    required("IYZICO_SECRET");
    getIyzicoBaseUrl();
  }

  if (isProd) {
    // Fotoğraf depolama: S3 ÖNERİLİR. Ama kalıcı diskli kendi sunucunda yerel
    // disk de olur → ALLOW_LOCAL_UPLOADS=1 ile aç (DÜZENLİ YEDEK ŞART; disk
    // ölürse fotoğraflar gider). S3 anahtarı varsa S3 kullanılır.
    if (process.env.AWS_S3_BUCKET) {
      required("AWS_ACCESS_KEY_ID");
      required("AWS_SECRET_ACCESS_KEY");
    } else if (process.env.ALLOW_LOCAL_UPLOADS !== "1") {
      throw new Error(
        "Üretim fotoğraf depolama: S3 anahtarlarını gir VEYA kalıcı diskli sunucunda ALLOW_LOCAL_UPLOADS=1 (ve yedek al).",
      );
    }

    // Soft-launch değilse: SMS + e-posta sağlayıcıları GERÇEK olmalı.
    if (!mockNotifyAllowed) {
      // Üretimde SMS gerçek olmalı (takip linki temel akış).
      if (!smsLive) {
        throw new Error(
          "Üretimde SMS_MODE=live olmalı (ya da soft-launch için ALLOW_MOCK_NOTIFY=1).",
        );
      }
      const provider = (process.env.SMS_PROVIDER ?? "netgsm").toLowerCase();
      if (provider === "twilio") {
        required("TWILIO_SID");
        required("TWILIO_TOKEN");
        required("TWILIO_FROM");
      } else {
        required("NETGSM_USERCODE");
        required("NETGSM_PASSWORD");
        required("NETGSM_HEADER");
      }

      // Halıcı hesap doğrulaması e-posta ile → üretimde SMTP zorunlu.
      if (!emailLive) {
        throw new Error(
          "Üretimde EMAIL_MODE=live olmalı (ya da soft-launch için ALLOW_MOCK_NOTIFY=1).",
        );
      }
      required("SMTP_HOST");
      required("SMTP_USER");
      required("SMTP_PASS");
      required("EMAIL_FROM");
    }
  } else if (process.env.AWS_S3_BUCKET) {
    // dev'de bucket verildiyse anahtarları da iste
    required("AWS_ACCESS_KEY_ID");
    required("AWS_SECRET_ACCESS_KEY");
  }

  validated = true;
}
