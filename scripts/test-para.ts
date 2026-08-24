/**
 * PARA ALANI BİRİM TESTİ (2026-08-11).
 *
 * NEDEN VAR: ikiz denetimi, kuruşlu fiyatın forma ÖN DOLU gelirken 10-100
 * katına çıktığını buldu. Zincir:
 *   Prisma Decimal(10,2) 1250.50 → String() → "1250.5"
 *   paraBicimle("1250.5") → nokta SİLİNİR → "12505" → ekranda "12.505"
 *   parseTutar("12.505") → binlik sanılır → 12505          ← 10 KATI
 *
 * `paraBicimle` KULLANICININ yazdığı için doğruydu (kullanıcıda nokta =
 * binlik ayıracı). Hata, VERİTABANI değerini de ondan geçirmekti; orada
 * nokta = ondalık ayıracı. İki biçim karıştırıldı.
 *
 * Şoför alana DOKUNMADAN "Teslim Et"e bassa bile yanlış tutar kaydediliyordu.
 * Canlıda patlamamıştı çünkü 53 fiyatın hiçbiri kuruşlu değildi — ilk
 * "1.250,50" yazan halıcıda patlayacaktı. Bu test o mayını geri koydurmaz.
 *
 * Çalıştır: npx tsx scripts/test-para.ts
 */
import { paraBicimle, paraBicimleSayi } from "../src/components/MoneyInput";
import { parseTutar } from "../src/lib/money";

let gecti = 0;
let kaldi = 0;

function bekle(ad: string, kosul: boolean, ek = "") {
  if (kosul) {
    gecti++;
    console.log(`  ✓ ${ad}`);
  } else {
    kaldi++;
    console.log(`  ✗ ${ad}${ek ? " — " + ek : ""}`);
  }
}

console.log("PARA ALANI\n");

console.log("A) 🔴 GİDİŞ-DÖNÜŞ: DB değeri forma dolar, dokunulmadan kaydedilir");
{
  // `String(Prisma.Decimal)` cikti bicimleri
  const ornekler = ["1250.5", "1250.05", "1499.6", "85.5", "1250", "900", "0.5"];
  for (const db of ornekler) {
    const ekran = paraBicimleSayi(db);
    const kayit = parseTutar(ekran);
    bekle(
      `${db} → "${ekran}" → ${kayit}`,
      Math.abs(kayit - Number(db)) < 0.005,
      `beklenen ${db}, gelen ${kayit}`,
    );
  }
}

console.log("\nB) ESKİ YOL HÂLÂ BOZUK OLMALI (regresyon bekçisi)");
{
  // paraBicimle KULLANICI girdisi icindir; DB degeri ona verilirse bozar.
  // Bu testin amaci: birisi defaultNumber yerine tekrar defaultValue baglarsa
  // hatanin GERI GELDIGINI burada gorsun.
  const bozuk = parseTutar(paraBicimle("1250.5"));
  bekle(
    "paraBicimle(DB değeri) hâlâ 12505 üretiyor — bu yüzden kullanılmamalı",
    bozuk === 12505,
    `gelen ${bozuk}`,
  );
}

console.log("\nC) KULLANICI GİRDİSİ eskisi gibi çalışmalı");
{
  bekle('"1250,50" → 1250.5', parseTutar(paraBicimle("1250,50")) === 1250.5);
  bekle('"1.250,50" → 1250.5', parseTutar(paraBicimle("1.250,50")) === 1250.5);
  bekle('"100000" → 100000', parseTutar(paraBicimle("100000")) === 100000);
  bekle('binlik ayıracı basılıyor', paraBicimle("100000") === "100.000");
  bekle('kuruş iki haneyle sınırlı', paraBicimle("1250,567") === "1.250,56");
}

console.log("\nD) SINIR DURUMLARI");
{
  bekle("null → boş", paraBicimleSayi(null) === "");
  bekle("undefined → boş", paraBicimleSayi(undefined) === "");
  bekle("boş string → boş", paraBicimleSayi("") === "");
  bekle("sayı olmayan → boş", paraBicimleSayi("abc") === "");
  bekle("tam sayıda kuruş yazılmaz", paraBicimleSayi("2400") === "2.400");
  bekle("kuruş sıfırsa yazılmaz", paraBicimleSayi("2400.00") === "2.400");
  bekle("tek haneli kuruş 2 haneye tamamlanır", paraBicimleSayi("10.5") === "10,50");
  bekle("number tipi de kabul", paraBicimleSayi(1250.5) === "1.250,50");
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi > 0 ? 1 : 0);
