import { prisma } from "@/lib/prisma";
import { trWeekStartUTC } from "@/lib/time";

// HAFTALIK HALI NUMARASI — dükkân genelinde 1, 2, 3… (2026-08-10, işletme sahibi).
//
// NEDEN YENİ BİR NUMARA: `OrderPhoto.carpetNo` zaten vardı ama o SİPARİŞ İÇİ
// sıradır (bir siparişin 3 halısı 1-2-3'tür). Depoda halıyı arayan kişinin
// elinde sipariş kodu yoktur; ona DÜKKÂN GENELİNDE tek bir numara lazım.
// Bu dosya onu üretir. Sipariş içi numaralandırma AYNEN DURUYOR — üstüne
// bir gösterim katmanı eklendi, altındaki mantığa dokunulmadı (bu depoda
// ikiz mantık ayrıştırması iki kez pahalıya patladı: 4.65a ve WhatsApp).
//
// 🔑 NEDEN SAYAÇ SIFIRLANIRKEN ATLAMA YAPAR:
// İşletme sahibi "her hafta yenilensin" dedi — numaralar küçük kalsın diye
// doğru istek. Ama saf sıfırlama, dükkânda BEKLEYEN halıyla çakışır: yıkama
// uzarsa ya da müşteri halısını almazsa aynı anda iki tane "3" olur.
// Numaranın TEK İŞİ halıyı bulmak; tam da en çok gerektiği anda (unutulmuş
// eski halı) yanıltırsa hiç olmamış sayılır. O yüzden sayaç her pazartesi
// 1'den başlar AMA dükkânda duran bir numarayı ATLAR. Arada boşluk çıkabilir
// (1, 2, 4, 5) — bu zararsızdır ve kendi kendini açıklar; iki canlı "3" asla
// olmaz.

/** Halının hâlâ dükkânda/yolda sayıldığı durumlar (numarası "dolu"dur). */
export const DUKKANDA = ["PICKED_UP", "WASHING", "OUT_FOR_DELIVERY"] as const;

/** Sonsuz döngüye karşı emniyet: bu kadar deneyip vazgeçilir. */
const TARAMA_TAVANI = 10_000;

/**
 * Bir siparişe verilecek İLK halı numarası (saf fonksiyon — testlenebilir).
 *
 * @param adet         siparişteki halı sayısı (en az 1)
 * @param dolu         dükkânda duran halıların numaraları
 * @param buHaftaEnBuyuk bu hafta dağıtılmış en büyük numara (yoksa 0)
 *
 * Dönen `n` için halılar `n … n+adet-1` numaralarını alır.
 */
export function sonrakiIlkNo(
  adet: number,
  dolu: ReadonlySet<number>,
  buHaftaEnBuyuk: number,
): number {
  const kac = Math.max(1, Math.floor(adet));
  // Bu hafta dağıtılanların ÜSTÜNDEN devam: numaralar hafta içinde artarak
  // gitsin (1, 2, 3…). Hafta yeniyse 1'den başlar.
  const baslangic = Math.max(1, buHaftaEnBuyuk + 1);
  for (let n = baslangic; n < baslangic + TARAMA_TAVANI; n++) {
    let uyar = true;
    for (let k = 0; k < kac; k++) {
      if (dolu.has(n + k)) {
        uyar = false;
        // Çakışan numaranın ÜSTÜNE atla — birer birer denemek gereksiz.
        n += k;
        break;
      }
    }
    if (uyar) return n;
  }
  // Buraya düşmek pratikte imkânsız (10.000 ardışık dolu numara). Yine de
  // sessizce yanlış numara vermektense en büyüğün bir üstünü ver.
  return Math.max(baslangic, ...dolu) + 1;
}

/** Bir siparişin halı numaraları: `carpetNoBase` varsa dükkân numarası. */
export function haliNolari(
  carpetNoBase: number | null,
  adet: number,
): number[] {
  const kac = Math.max(0, Math.floor(adet));
  if (carpetNoBase == null) return [];
  return Array.from({ length: kac }, (_, i) => carpetNoBase + i);
}

/** Ekranda gösterilecek etiket: dükkân numarası varsa o, yoksa sipariş içi sıra. */
export function haliEtiketi(
  carpetNoBase: number | null,
  icSira: number,
): string {
  return carpetNoBase == null ? `Halı ${icSira}` : `No ${carpetNoBase + icSira - 1}`;
}

/**
 * Siparişe dükkân numarası ata (alımda, PICKED_UP anında).
 *
 * ⚠️ İDEMPOTENT DEĞİL — çağıran, `carpetNoBase` zaten doluysa çağırmamalı.
 * Üç alım yolu da (panel · şoför web · şoför uygulaması) bunu kullanır;
 * kural kopyalanmaz (bkz. lib/carpet.ts'teki aynı gerekçe).
 *
 * ⚠️ DÜRÜST SINIR — YARIŞ: iki alım tam aynı anda olursa ikisi de aynı
 * numarayı okuyabilir. Bu hacimde (günde onlarca alım) pratikte görülmez;
 * görülürse çözüm işletme başına bir sayaç satırı + `SELECT … FOR UPDATE`.
 * Bugün bunu kurmuyorum çünkü karmaşıklığı kazancından büyük.
 */
export async function haliNoAta(
  businessId: string,
  adet: number,
  now: Date = new Date(),
): Promise<number> {
  const haftaBasi = trWeekStartUTC(now);

  const kayitlar = await prisma.order.findMany({
    where: { businessId, carpetNoBase: { not: null } },
    select: {
      status: true,
      carpetCount: true,
      carpetNoBase: true,
      pickedUpAt: true,
    },
  });

  const dolu = new Set<number>();
  let buHaftaEnBuyuk = 0;
  for (const o of kayitlar) {
    const base = o.carpetNoBase!;
    // `carpetCount` girilmemişse tek halı sayılır — numarayı yine de tutar.
    const kac = Math.max(1, o.carpetCount ?? 1);
    const son = base + kac - 1;

    if ((DUKKANDA as readonly string[]).includes(o.status)) {
      for (let n = base; n <= son; n++) dolu.add(n);
    }
    // Bu hafta dağıtılmış mı: alım anına bakılır (numara alımda doğuyor).
    if (o.pickedUpAt && o.pickedUpAt >= haftaBasi && son > buHaftaEnBuyuk) {
      buHaftaEnBuyuk = son;
    }
  }

  return sonrakiIlkNo(adet, dolu, buHaftaEnBuyuk);
}
