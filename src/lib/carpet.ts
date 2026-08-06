// HALI SAYISI VE NUMARALARI — TEK KAYNAK (2026-08-06).
//
// NEDEN AYRI DOSYA: alım (PICKED_UP) ÜÇ ayrı yoldan geçiyor —
//   · panel            → app/panel/actions.ts   (advanceOrderPanel)
//   · şoför web        → app/sofor/actions.ts
//   · şoför uygulaması → lib/driverOrders.ts    (driverPickup)
// Doğrulama üç yere kopyalansaydı klasik İKİZ MANTIK tuzağı olurdu: biri
// güncellenir, öteki sessizce eski kuralla çalışırdı. Bu depoda tam bu hata
// sipariş bildirimlerinde yaşandı (WhatsApp yalnız panele bağlanmıştı).

/** Bir siparişte kabul edilen en yüksek halı sayısı. */
export const MAX_HALI = 100;

export const CARPET_COUNT_HATA = `Halı sayısı 1 ile ${MAX_HALI} arasında bir tam sayı olmalı.`;

/**
 * Ham girdiyi halı sayısına çevirir.
 *  - `null`        → girilmemiş (opsiyonel; eski davranış sürer)
 *  - `number`      → geçerli sayı
 *  - `"gecersiz"`  → girilmiş ama hatalı; çağıran hata döndürmeli
 *
 * Boş string / undefined "girilmemiş" sayılır: alan opsiyonel olduğu için
 * boş bırakmak hata değildir, ama "abc" ya da 0 yazmak hatadır — sessizce
 * yok saymak "girdim ama kaydolmadı" şikâyetinin kaynağı olur.
 */
export function normalizeCarpetCount(
  ham: unknown,
): number | null | "gecersiz" {
  if (ham == null) return null;
  const s = String(ham).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > MAX_HALI) return "gecersiz";
  return n;
}

/**
 * Siparişin halı numaraları ve her birinin fotoğrafı.
 *
 * `carpetCount` doluysa numaralar 1..N'dir ve FOTOĞRAFSIZ halılar da listede
 * görünür — "5 geldi, 5 gitti mi?" sorusunun cevabı budur.
 * `carpetCount` null olan eski siparişlerde numaralar yalnız fotoğraflardan
 * okunur (eski davranış korunur).
 */
export function haliSlotlari<T extends { carpetNo: number | null }>(
  carpetCount: number | null,
  fotograflar: T[],
): { no: number; fotograflar: T[] }[] {
  const gruplar = new Map<number, T[]>();
  for (const f of fotograflar) {
    if (f.carpetNo == null) continue;
    const liste = gruplar.get(f.carpetNo) ?? [];
    liste.push(f);
    gruplar.set(f.carpetNo, liste);
  }
  const enBuyuk = Math.max(0, ...gruplar.keys());
  // Veri tutarsızsa (numara sayıdan büyük) kaybetme: ikisinin büyüğünü al.
  const adet = Math.max(carpetCount ?? 0, enBuyuk);
  const cikti: { no: number; fotograflar: T[] }[] = [];
  for (let no = 1; no <= adet; no++) {
    cikti.push({ no, fotograflar: gruplar.get(no) ?? [] });
  }
  return cikti;
}

/** Fotoğrafı olmayan halı numaraları (panelde "eksik" uyarısı için). */
export function fotografsizHalilar(
  carpetCount: number | null,
  fotograflar: { carpetNo: number | null }[],
): number[] {
  if (carpetCount == null) return [];
  return haliSlotlari(carpetCount, fotograflar)
    .filter((s) => s.fotograflar.length === 0 && s.no <= carpetCount)
    .map((s) => s.no);
}
