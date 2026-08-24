/**
 * 🔴 FOTOĞRAFI GÖNDERMEDEN ÖNCE KÜÇÜLT (2026-08-11) — mobil ikiziyle eşitleme.
 *
 * MOBİLDE VAR, WEBDE YOKTU (ikiz denetimi bulgusu). `driver-app/src/Orders.tsx`
 * kareyi 1600 px'e indirip q0.6 ile gönderiyor (~200-400 KB). Web ise telefonun
 * ürettiği kareyi OLDUĞU GİBİ yüklüyordu: 1,5-3 MB, 48 MP telefonlarda daha da
 * fazla.
 *
 * İKİ ZARAR:
 *  1. Şoför her karede kendi hattından megabaytlarca veri yakıyordu (günde 10
 *     sipariş × 2 kare ≈ 30-60 MB; mobilde aynı iş ~5 MB).
 *  2. **TAM BAŞARISIZLIK**: 8 MB'ı aşan kare `next.config.mjs` içindeki
 *     `bodySizeLimit: "8mb"` sınırına takılıyor, güzel hata mesajı bile
 *     çalışmadan istek düşüyor ve şoför jenerik hata ekranını görüyor —
 *     sipariş listesi komple kayboluyor.
 *
 * ⚠️ SUNUCUDA TEK SATIR DEĞİŞMİYOR: `lib/orderPhoto.ts` zaten 2560 px WebP'ye
 * çeviriyor, yani gelen fazlalığın neredeyse tamamı orada atılıyordu. Bu
 * yüzden küçültme KAYIP DEĞİL — boşuna taşınan baytın kesilmesi.
 *
 * ⚠️ BAŞARISIZLIKTA ORİJİNALE DÜŞER: tarayıcı canvas/toBlob desteklemiyorsa
 * ya da kare çözülemezse dosya olduğu gibi gönderilir. Küçültme bir
 * iyileştirmedir; fotoğrafın hiç gitmemesine yol açmamalı (fotoğraf olmadan
 * şoför siparişi ilerletemiyor).
 */

/** Uzun kenar bu piksele indirilir — mobil ikiziyle aynı (Orders.tsx). */
const HEDEF_UZUN_KENAR = 1600;
/** JPEG kalitesi — mobil ikiziyle aynı. */
const KALITE = 0.6;
/** Bundan küçük dosyaya dokunma; küçültme kazancı zahmete değmez. */
const DOKUNMA_ESIGI = 600 * 1024;

export async function fotoKucult(dosya: File): Promise<File> {
  try {
    if (!dosya.type.startsWith("image/")) return dosya;
    if (dosya.size <= DOKUNMA_ESIGI) return dosya;
    if (typeof createImageBitmap !== "function") return dosya;

    // ⚠️ EXIF YÖNÜ ŞART: seçeneksiz `createImageBitmap` bazı motorlarda kareyi
    // HAM yönde verir; canvas çıktısı da EXIF taşımadığı için sunucudaki
    // `sharp().rotate()` no-op olur ve KANIT FOTOĞRAFI YAN kaydedilir.
    // Yani küçültmenin kendisi yeni bir hata doğururdu (doğrulama denetimi).
    const bitmap = await createImageBitmap(dosya, {
      imageOrientation: "from-image",
    });
    const enBuyuk = Math.max(bitmap.width, bitmap.height);
    const oran = enBuyuk > HEDEF_UZUN_KENAR ? HEDEF_UZUN_KENAR / enBuyuk : 1;
    const en = Math.round(bitmap.width * oran);
    const boy = Math.round(bitmap.height * oran);

    const tuval = document.createElement("canvas");
    tuval.width = en;
    tuval.height = boy;
    const ctx = tuval.getContext("2d");
    if (!ctx) return dosya;
    ctx.drawImage(bitmap, 0, 0, en, boy);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((çöz) =>
      tuval.toBlob((b) => çöz(b), "image/jpeg", KALITE),
    );
    if (!blob) return dosya;
    // Küçültme işe yaramadıysa (zaten sıkışık kare) orijinali koru.
    if (blob.size >= dosya.size) return dosya;

    const ad = dosya.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], ad, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return dosya; // hiçbir koşulda yüklemeyi engelleme
  }
}

/** İnsan okur boyut ("1,8 MB") — ekranda ne kadar küçüldüğünü göstermek için. */
export function boyutYaz(bayt: number): string {
  return bayt >= 1024 * 1024
    ? `${(bayt / 1048576).toFixed(1).replace(".", ",")} MB`
    : `${Math.round(bayt / 1024)} KB`;
}
