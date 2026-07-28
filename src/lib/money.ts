// PARA AYRIŞTIRMA — TEK KAYNAK (2026-07-28).
//
// NEDEN: para girilen alanlara binlik ayıracı eklendi (100000 → 100.000, çünkü
// halıcı ekranda okuyamıyordu). Sunucu tarafındaki okuyucular ise dağınıktı:
// bazısı `Number(x)`, bazısı `Number(x.replace(",", "."))` yapıyordu. İkisi de
// "1.250,50" biçimini NaN'a çeviriyordu — yani ekranda güzel görünen tutar
// kaydedilirken patlayacaktı. Artık hepsi buradan geçiyor.
//
// KABUL EDİLEN BİÇİMLER (hepsi aynı sayıyı verir):
//   "1250"  "1250,50"  "1250.50"  "1.250,50"  "100.000"  " 1 250,50 "
//
// KURAL: nokta YALNIZ tam 3 haneyi önceliyorsa binlik ayıracıdır ve silinir;
// aksi halde ondalık noktadır ve korunur ("1250.50" İngilizce yazım da çalışsın).
export function parseTutar(raw: unknown): number {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}\b)/g, "") // binlik noktalarını sil
    .replace(",", "."); // kuruş virgülünü noktaya çevir
  if (s === "") return NaN;
  return Number(s);
}

/** Tutar geçerli mi (pozitif, sonlu, makul üst sınırın altında)? */
export function gecerliTutar(n: number, enCok = 10_000_000): boolean {
  return Number.isFinite(n) && n > 0 && n <= enCok;
}
