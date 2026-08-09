// Merkezi ortam-değişkeni doğrulaması.
// Amaç: eksik/zayıf/placeholder değerlerle SESSİZCE yanlış çalışmak yerine
// (ödeme alınmadan PAID, oturum sahteciliği, kırık SMS linkleri) başlangıçta
// NET bir hatayla durmak. Build sırasında atlanır (build env'inde sırlar olmaz).

import { PLAN_TUTARLARI, merdivenAktif } from "@/lib/plan";

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

/** iyzico tekrarlayan abonelik ödeme planı referans kodu (panelde/script'le
 * oluşturulan "2.400 TL/ay" planı). Boşsa tekrarlayan abonelik UI'ı GÖSTERİLMEZ
 * (havale akışı kalır) — yanlışlıkla yarım kurulu düzenli-ödeme açılmaz. */
export function getIyzicoPlanReference(): string {
  return process.env.IYZICO_PLAN_REFERENCE ?? "";
}
/** Tekrarlayan abonelik gerçekten kullanılabilir mi: canlı + plan tanımlı. */
export const recurringEnabled =
  paymentsLive && (process.env.IYZICO_PLAN_REFERENCE ?? "").length > 0;

/** Bağlı iyzico planının KDV DAHİL fiyatı. Normalde 2.400; CANLIYA ALMA
 * doğrulamasında 1 TL'lik test planı bağlanır → kayıtlar/e-postalar gerçek
 * çekilen tutarı göstersin diye .env'den okunur (IYZICO_PLAN_AMOUNT=1).
 * Plan referansı değişince bu değeri de değiştir — ikisi ÇİFTTİR. */
export function getIyzicoPlanAmount(): number {
  const v = Number(process.env.IYZICO_PLAN_AMOUNT);
  return Number.isFinite(v) && v > 0 ? v : 2400;
}

/** FİYAT MERDİVENİ ANA ANAHTARI (FIYAT-2026-08-09.md).
 *
 * Model değişikliği TEK ANDA yürürlüğe girmek zorunda: fiyat, paket kısıtlaması,
 * VİTRİN görünürlüğü, koltuk kapısı ve komisyon matrahı birbirine bağlı. Bunları
 * ayrı ayrı açmak yarım bir sistem üretir — örneğin koltuk kapısı fiyat merdiveni
 * bağlanmadan açılırsa, bugün `driverSeats=1` olan 39 işletmenin hiçbiri ikinci
 * şoförünü ekleyemez ve kimse fark için para ödemiyordur.
 *
 * Kapalıyken sistem 2026-08-09 öncesiyle BİREBİR aynı davranır — geri dönüş
 * yolu olarak duruyor.
 *
 * NOT (2026-08-09): "30 gün önceden bildirim" burada YAZILIYDI, kaldırıldı.
 * O yükümlülük karşı tarafa karşıdır; kayıtlı 39 işletmenin tamamı işletme
 * sahibinin kendi kayıtları, yani bildirilecek üçüncü kişi yok. Gerçek
 * müşteri geldiğinde fiyat değişikliği yine sözleşme §9'a tabidir.
 */
export { merdivenAktif };

/** FİYAT MERDİVENİ PLAN REFERANSLARI (FIYAT-2026-08-09.md) — HENÜZ KULLANILMIYOR.
 *
 * Yukarıdaki tek `IYZICO_PLAN_REFERENCE` sabit tek fiyat içindi. Merdivende
 * beş ayrı tutar var ve iyzico'da her tutarın AYRI planı bulunuyor (plan = fiyat,
 * paket değil — kurucu+2 şoför ile liste+1 şoför aynı 900'ü öder; paket başına
 * plan açmak aynı fiyattan iki plan yaratıp mutabakatı bozardı).
 *
 * Planlar canlıda açık (2026-08-09), referanslar DEVIR §1'de tabloda. Sunucu
 * .env'ine IYZICO_PLAN_REF_<tutar> satırları eklenmeden bu eşleme BOŞ döner ve
 * `recurringPlanFor` null verir → çağıran taraf düzenli ödeme talimatı AÇMAZ.
 * Yarım kurulu tahsilat açılmasın diye kasıtlı olarak fail-closed.
 */
/** iyzico referans kodu biçimi (UUID). Şekil denetimi ŞART: kurulum script'i
 *  bulunamayan planlar için `<BULUNAMADI>` yer tutucusu basıyor; o satır
 *  yanlışlıkla .env'e yapıştırılırsa şekilsiz bir dize "geçerli referans"
 *  sayılır ve talimat FAIL-OPEN açılırdı (denetim bulgusu). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getIyzicoPlanRefByGross(gross: number): string {
  // TAM EŞLEŞME — yuvarlama YOK (denetim bulgusu). `Math.round` ile 1.499,60
  // gibi bir tutar 1.500 planına yapışıyor, sonra kayda yuvarlanmamış tutar
  // yazılıyordu: karttan 1.500 çekilirken defterde 1.499,60 duruyordu.
  // Merdiven dışı bir tutar üretildiyse bu bir HATADIR, ona en yakın planı
  // seçerek örtmek yerine talimatı hiç açmamak doğrudur.
  if (!(PLAN_TUTARLARI as readonly number[]).includes(gross)) return "";
  const v = process.env[`IYZICO_PLAN_REF_${gross}`];
  const ref = typeof v === "string" ? v.trim() : "";
  return UUID_RE.test(ref) ? ref : "";
}

/** Bu tutar için düzenli ödeme talimatı açılabilir mi + hangi planla.
 *  0 TL (ücretsiz dönem) için talimat YOKTUR — çekilecek bir şey yok.
 *  Dönen `amount` planın KENDİ tutarıdır: çekilen ile kaydedilen ayrışamaz. */
export function recurringPlanFor(
  gross: number,
): { planReferenceCode: string; amount: number } | null {
  if (!paymentsLive || !(gross > 0)) return null;
  const ref = getIyzicoPlanRefByGross(gross);
  return ref ? { planReferenceCode: ref, amount: gross } : null;
}

/** Merdiven açıkken eksik/bozuk plan referanslarını AÇILIŞTA bildir.
 *  Sessiz null, uyanma gününde teşhisi imkânsız kılar: halıcı talimat veremez,
 *  kimse sebebini bilmez. `validateConfig` bunu çağırır. */
export function eksikPlanReferanslari(): number[] {
  if (!merdivenAktif) return [];
  return (PLAN_TUTARLARI as readonly number[]).filter(
    (t) => !getIyzicoPlanRefByGross(t),
  );
}

/** iyzico abonelik ÜRÜN referansı (planlar bunun altında açılır).
 *  scripts/iyzico-planlar.mjs bunu okur/yazar; kod tarafı yalnız teşhis için. */
export function getIyzicoProductReference(): string {
  return process.env.IYZICO_PRODUCT_REFERENCE ?? "";
}

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

  // MERDİVEN AÇIKSA plan referanslarının HEPSİ olmalı. Eksikse tek tek sessiz
  // null dönerdi: halıcı düzenli ödeme talimatı veremez, panelde sebebi
  // yazmaz, kimse bakmadan anlamaz. Uyanma günü teşhis edilebilir olsun.
  if (merdivenAktif && paymentsLive) {
    const eksik = eksikPlanReferanslari();
    if (eksik.length) {
      throw new Error(
        `FIYAT_MERDIVENI=1 ama şu tutarların iyzico plan referansı eksik/geçersiz: ` +
          eksik.map((t) => `IYZICO_PLAN_REF_${t}`).join(", ") +
          ` — referanslar UUID biçiminde olmalı (scripts/iyzico-planlar.ts basar).`,
      );
    }
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
