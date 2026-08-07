// DEMO ROTASI — SAF ÜRETEÇ (2026-08-07 akşam'da demoPanel.ts'ten AYRILDI).
//
// NEDEN AYRI DOSYA: `npm run test:konum` bu rotayı sınıyor (süzgeç demo izini
// yiyip haritayı boşaltmasın diye). demoPanel.ts prisma'yı içe aktardığı için
// testten çağrılamıyordu ve üreteç teste KOPYALANMIŞTI — yani klasik "ikiz
// mantık" tuzağı: biri değişince öteki sessizce bayatlar ve test gerçeği
// ölçmeyi bırakır. Artık tek kaynak burası; hem panel hem test buradan okur.

/**
 * Demo rotası — GERÇEK BİR TESLİMAT GÜNÜ GİBİ (yeniden yazıldı 2026-08-07 akşam).
 *
 * 🔴 NEDEN YENİDEN YAZILDI: eski üreteç 4 saate eşit aralıklı 26 nokta
 * yazıyordu. Bu, ~1,3 km/sa demek — YÜRÜYÜŞTEN yavaş. Konum süzgeci
 * (lib/konumFiltre.ts) haklı olarak "bu şoför duruyor" deyip izi tek noktaya
 * indiriyordu; demo haritası neredeyse boş çıkıyordu. Play incelemesi ve
 * komisyoncu tanıtımı bu ekranı görüyor.
 *
 * Artık gerçek gün deseni üretiliyor: **sürüş bacakları + aralarında duruşlar.**
 *  · sürüşte 10 sn'de bir nokta (~35 m adım ≈ 12 km/sa)
 *  · durakta 60 sn'de bir nokta, aynı yerde (küçük GPS titremesiyle)
 * Süzgeç bunu doğru okur: duruşlar tek noktaya iner, sürüşler çizilir.
 * `npm run test:konum` demo izini de sınıyor — bozulursa test kırmızı yanar.
 */
export const DEMO_DURAKLAR = [
  { oran: 0.25, dk: 12 },
  { oran: 0.55, dk: 47 },
  { oran: 0.82, dk: 8 },
];
/** Sürüş noktaları arası saniye (gerçek uygulamada 5-15 sn). */
const SURUS_ARALIK_SN = 10;
/** Durakta "buradayım" kalp atışı — uygulamadaki 60 sn ile aynı. */
const DURAK_ARALIK_SN = 60;
/** Tüm sürüş bacaklarının toplam süresi. */
export const SURUS_TOPLAM_DK = 34;

/** Halka üzerindeki bir orandan (0..1) koordinat. */
export function demoHalka(lat: number, lng: number, t: number) {
  const aci = 2 * Math.PI * t;
  return {
    lat: lat + 0.014 * Math.sin(aci) + 0.002 * Math.sin(3 * aci),
    lng: lng + 0.018 * (1 - Math.cos(aci)) * 0.6,
  };
}

/**
 * Zaman damgalı demo izi üretir. Dönen `ms` değeri rotanın BAŞINDAN itibaren
 * geçen süredir; çağıran bunu gerçek saate ekler.
 */
export function demoRotaNoktalari(lat: number, lng: number) {
  const noktalar: { lat: number; lng: number; ms: number }[] = [];
  const bacakSayisi = DEMO_DURAKLAR.length + 1;
  const bacakDk = SURUS_TOPLAM_DK / bacakSayisi;
  let ms = 0;
  let oran = 0;
  for (let b = 0; b < bacakSayisi; b++) {
    const hedef = b === bacakSayisi - 1 ? 1 : DEMO_DURAKLAR[b].oran;
    const adimSayisi = Math.max(2, Math.round((bacakDk * 60) / SURUS_ARALIK_SN));
    for (let i = 1; i <= adimSayisi; i++) {
      const t = oran + ((hedef - oran) * i) / adimSayisi;
      const k = demoHalka(lat, lng, t);
      noktalar.push({ ...k, ms });
      ms += SURUS_ARALIK_SN * 1000;
    }
    oran = hedef;
    // Durakta bekleme: aynı noktada, ufak titremeyle (gerçek GPS gibi).
    const durak = DEMO_DURAKLAR[b];
    if (durak) {
      const k = demoHalka(lat, lng, oran);
      const sayi = Math.round((durak.dk * 60) / DURAK_ARALIK_SN);
      for (let i = 0; i < sayi; i++) {
        noktalar.push({
          // ±8 m titreme: süzgecin duruş kümesini gerçek veride olduğu gibi sınar
          lat: k.lat + (((i * 7) % 5) - 2) * 0.00007,
          lng: k.lng + (((i * 3) % 5) - 2) * 0.00009,
          ms,
        });
        ms += DURAK_ARALIK_SN * 1000;
      }
    }
  }
  return noktalar;
}

