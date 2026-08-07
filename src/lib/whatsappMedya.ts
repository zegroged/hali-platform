// GELEN WHATSAPP MEDYASI — İNDİR VE KENDİ DEPOMUZA YAZ (2026-08-07 akşam).
//
// SORUN (işletme sahibi, canlı): *"WhatsApp konuşması çalışıyor ama fotoğraflar
// gözükmüyor — müşteri 'halımın şurasında leke var' diye fotoğraf atarsa ne
// yapacağız?"* Haklı: webhook bugüne kadar fotoğrafın YALNIZ metin karşılığını
// (`[fotoğraf]`) kaydediyordu, dosyanın kendisi hiç indirilmiyordu.
//
// NEDEN İNDİRMEK ŞART (link saklamak YETMEZ):
//  · Meta gelen mesajda dosyayı değil bir **medya kimliği** verir.
//  · Kimlikten alınan indirme adresi **~5 dakikada** ölür.
//  · Dosyanın kendisi Meta'da yalnız **30 gün** durur.
//  · Adres jetonla (Bearer) korunur — tarayıcıya doğrudan verilemez.
// Yani kaydetmezsek kanıt niteliğindeki fotoğraf 30 gün sonra yok olur.
// Hasar/leke tartışmasında lazım olacak tam da o fotoğraftır.
//
// ⚠️ ESKİ MESAJLAR GERİ GETİRİLEMEZ: medya kimliğini de saklamıyorduk.
// Bu koddan ÖNCE gelen fotoğraflar kayıptır; bundan sonrakiler durur.

import sharp from "sharp";
import { saveObject } from "@/lib/storage";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Tavan: WhatsApp'ın kendi video sınırı 16 MB; üstünü zaten göndertmez. */
const MAX_BYTE = 16 * 1024 * 1024;
const MAX_EDGE = 2560;
const WEBP_QUALITY = 88;

/**
 * Servis edilmesine izin verdiğimiz türler. ⚠️ BEYAZ LİSTE ŞART:
 * `image/svg+xml` ve `text/html` BİLEREK YOK — tarayıcıda çalışan içerik
 * barındırıp kendi alan adımızda XSS'e dönüşürler.
 */
const TUR_UZANTI: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

export type WaMedya = { url: string; tur: string } | null;

/** `audio/ogg; codecs=opus` gibi başlıkları sadeleştir. */
function turSadelestir(ham: string | undefined): string {
  return (ham ?? "").split(";")[0].trim().toLowerCase();
}

/**
 * Medya kimliğinden dosyayı indirir, (fotoğrafsa) küçültüp WebP'ye çevirir ve
 * kendi depomuza yazar. Başarısızlıkta `null` — çağıran akışı BOZMAMALI,
 * mesajın metin satırı zaten kaydedilmiş olur.
 *
 * Fotoğraflar sharp'tan geçer: hem boyut düşer hem de **EXIF temizlenir**
 * (telefon fotoğrafı müşterinin ev KONUMUNU taşıyabiliyor — KVKK'da gereksiz
 * veri işlemek olurdu).
 */
export async function waMedyayiIndir(mediaId: string): Promise<WaMedya> {
  const jeton = process.env.WHATSAPP_TOKEN;
  if (!jeton || !mediaId) return null;

  try {
    // 1) Kimlikten geçici indirme adresi
    const bilgiRes = await fetch(`${GRAPH}/${mediaId}`, {
      headers: { Authorization: `Bearer ${jeton}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!bilgiRes.ok) {
      console.error(
        `[wa-medya] bilgi alınamadı id=${mediaId} durum=${bilgiRes.status} ${await bilgiRes
          .text()
          .catch(() => "")}`,
      );
      return null;
    }
    const bilgi = (await bilgiRes.json()) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
    };
    if (!bilgi.url) {
      console.error(`[wa-medya] adres yok id=${mediaId}`);
      return null;
    }
    if (bilgi.file_size != null && bilgi.file_size > MAX_BYTE) {
      console.error(
        `[wa-medya] dosya çok büyük id=${mediaId} boyut=${bilgi.file_size}`,
      );
      return null;
    }

    // 2) Dosyanın kendisi — bu adres de Bearer ister (tarayıcıya verilemez).
    const dosyaRes = await fetch(bilgi.url, {
      headers: { Authorization: `Bearer ${jeton}` },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (!dosyaRes.ok) {
      console.error(
        `[wa-medya] indirilemedi id=${mediaId} durum=${dosyaRes.status}`,
      );
      return null;
    }
    const ham = Buffer.from(await dosyaRes.arrayBuffer());
    // Bildirilen boyuta güvenme, GERÇEĞİNİ ölç.
    if (ham.byteLength === 0 || ham.byteLength > MAX_BYTE) {
      console.error(`[wa-medya] boyut kabul edilmedi id=${mediaId} b=${ham.byteLength}`);
      return null;
    }

    const bildirilenTur =
      turSadelestir(dosyaRes.headers.get("content-type") ?? undefined) ||
      turSadelestir(bilgi.mime_type);

    let govde = ham;
    let tur = bildirilenTur;
    let uzanti = TUR_UZANTI[bildirilenTur];

    if (bildirilenTur.startsWith("image/")) {
      try {
        govde = await sharp(ham, { limitInputPixels: 50_000_000 })
          .rotate() // EXIF yönü — yan çekilmiş fotoğraf düz görünsün
          .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();
        tur = "image/webp";
        uzanti = "webp";
      } catch (e) {
        // Çıkartma (animasyonlu webp) gibi sharp'ın zorlandığı hâllerde
        // orijinali sakla — ama YALNIZ beyaz listedeyse.
        console.error(`[wa-medya] sharp dönüştüremedi id=${mediaId}:`, e);
        if (!uzanti) return null;
      }
    }
    if (!uzanti) {
      console.error(`[wa-medya] desteklenmeyen tür id=${mediaId} tur=${bildirilenTur}`);
      return null;
    }

    // 3) Kendi depomuz. Ay ay klasörleniyor: ileride saklama süresi
    // uygulanacaksa (KVKK) klasör silmek yetsin.
    const ay = new Date().toISOString().slice(0, 7); // YYYY-MM
    const ad = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${uzanti}`;
    const url = await saveObject(`uploads/wa/${ay}/${ad}`, govde, tur);
    return { url, tur };
  } catch (e) {
    console.error(`[wa-medya] beklenmeyen hata id=${mediaId}:`, e);
    return null;
  }
}
