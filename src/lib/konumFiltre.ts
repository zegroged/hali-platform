// KONUM İZİ AYIKLAMA (2026-08-06).
//
// SORUN (kullanıcı, ölçüldü): şoför evden hiç çıkmadı ama Canlı Takip
// haritası uzun bir yol çizdi. Prod verisi:
//   · son 15 ping → ~9 m × ~22 m (gerçekten sabit, veri DOĞRU)
//   · tüm aralık  → ~215 m × ~305 m (birkaç AYKIRI nokta)
// Harita ardışık ping'leri düz çizgiyle bağladığı için tek bir aykırı nokta
// "gidip gelmiş" gibi koca bir yol üretiyor.
//
// MEVCUT SÜZGEÇLER NEDEN YETMİYOR (ikisi de var, bu vakayı kaçırıyor):
//  · Hassasiyet süzgeci (150 m): telefon "accuracy: 20 m" deyip 300 m
//    sapabiliyor — kapalı mekânda wifi/baz istasyonu konumlaması KENDİNDEN
//    EMİN ama yanlış. Beyan edilen hassasiyet gerçeği söylemiyor.
//  · Işınlanma süzgeci (180 km/sa): ping'ler ~70 sn arayla geliyor;
//    305 m / 70 sn = 16 km/sa. Normal araç hızı görünüyor, yakalanamıyor.
//
// ÇÖZÜM — ÇİZİM ANINDA AYIKLAMA: ham veri OLDUĞU GİBİ saklanır (kanıt değeri
// ve KVKK kaydı bozulmaz), yalnız haritaya çizilen dizi süzülür. Böylece
// yanlış bir süzgeç veri kaybettirmez; kötü giderse tek satırla geri alınır.
//
// ⚠️ YOLLARA OTURTMA BUNUN YERİNE GEÇMEZ: sapmış nokta yola oturtulunca
// GERÇEK bir sokağa düşer ve harita, şoförün hiç girmediği sokakta düzgünce
// ilerlediğini gösterir — yalan daha inandırıcı olur. Önce ayıklama, sonra
// oturtma (DEVIR §5-B/1c).

/** İki nokta arası metre (haversine). */
export function metre(
  [aLat, aLng]: [number, number],
  [bLat, bLng]: [number, number],
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Bir noktanın "sivri" (aykırı) sayılması için komşularından uzaklığı. */
const SIVRI_ESIK_M = 120;
/** Komşuların birbirine bu kadar yakın olması gerekir ki ortadaki sivri sayılsın. */
const KOMSU_YAKINLIK_M = 80;
/** Duruş kümesi yarıçapı: bu kadar dar alanda kalan iz "duruyor" demektir. */
const DURUS_YARICAP_M = 60;

/**
 * SİVRİ AYIKLAMA. Bir nokta HER İKİ komşusundan uzak, ama komşular birbirine
 * yakınsa → gerçek hareket değil, sapmış tek fix. Çıkarılır.
 *
 * Gerçek hareket bunu tetiklemez: araç ilerlerken ardışık noktalar sırayla
 * uzaklaşır, komşular birbirine YAKIN OLMAZ. Yani yalnız "git-gel" deseni
 * elenir.
 */
export function sivrileriAyikla(
  noktalar: [number, number][],
): [number, number][] {
  if (noktalar.length < 3) return noktalar;
  const cikti: [number, number][] = [noktalar[0]];
  for (let i = 1; i < noktalar.length - 1; i++) {
    const onceki = cikti[cikti.length - 1];
    const sonraki = noktalar[i + 1];
    const bu = noktalar[i];
    const sivriMi =
      metre(onceki, bu) > SIVRI_ESIK_M &&
      metre(bu, sonraki) > SIVRI_ESIK_M &&
      metre(onceki, sonraki) < KOMSU_YAKINLIK_M;
    if (!sivriMi) cikti.push(bu);
  }
  cikti.push(noktalar[noktalar.length - 1]);
  return cikti;
}

/**
 * DURUYOR MU? — TÜM iz dar bir kümede mi.
 *
 * ⚠️ Bu YALNIZ "gün boyu hiç kıpırdamadı" durumunu yakalar. Gün içinde hem
 * duran hem gezen normal bir şoförde ASLA tetiklenmez. Asıl iş
 * `duruslariTopla`'da (aşağıda) — bu fonksiyon yalnız canlı takipteki
 * "hiç hareket yok" özel durumu için duruyor.
 */
export function duruyorMu(noktalar: [number, number][]): boolean {
  if (noktalar.length < 2) return true;
  const [ilkLat, ilkLng] = noktalar[0];
  let enUzak = 0;
  for (const n of noktalar) {
    const d = metre([ilkLat, ilkLng], n);
    if (d > enUzak) enUzak = d;
    if (enUzak > DURUS_YARICAP_M) return false; // erken çık
  }
  return true;
}

/** Bir duruş kümesi sayılmak için gereken en az ardışık nokta. */
const DURUS_MIN_NOKTA = 3;

/**
 * 🔴 DURUŞ KÜMELERİNİ TEK NOKTAYA İNDİR — ASIL DÜZELTME (2026-08-07).
 *
 * NEDEN YENİDEN YAZILDI: ilk sürüm duruşu **tüm ize** bakarak arıyordu ve
 * gerçek veriyle sınanınca çuvalladı. Canlı ölçüm (ahmet, 10 saat, 325 nokta):
 *   · 5063 m / 825 sn = 22 km/sa   ← GERÇEK sürüş
 *   · 2533 m / 163 sn = 56 km/sa   ← GERÇEK sürüş
 *   · 128 atlama 0-10 m arasında   ← park hâlinde GPS titremesi
 * Yani iz hem sürüş hem duruş içeriyor; "tümü dar mı" sorusu hiç tutmuyordu
 * ve 325 noktanın yalnız 9'u eleniyordu.
 *
 * DOĞRU SORU: "şu ANDA duruyor mu?" Şoför park edip 20 dakika beklerse
 * 20 ping dar bir daire içinde titrer; harita bunları düz çizgilerle bağlayınca
 * park yerinde bir "gezinti" çizer — kullanıcının bildirdiği tam durum.
 *
 * ÇÖZÜM: ardışık noktalar `DURUS_YARICAP_M` içinde kaldığı sürece aynı kümeye
 * konur; küme `DURUS_MIN_NOKTA`'ya ulaşırsa TEK temsilci noktaya indirilir
 * (kümenin ortalaması). Gerçek sürüş etkilenmez: ilerleyen araçta ardışık
 * noktalar yarıçapı hemen aşar, küme oluşmaz.
 */
export function duruslariTopla(
  noktalar: [number, number][],
): [number, number][] {
  if (noktalar.length < DURUS_MIN_NOKTA) return noktalar;
  const cikti: [number, number][] = [];
  let kume: [number, number][] = [noktalar[0]];

  const kumeyiBosalt = () => {
    if (kume.length >= DURUS_MIN_NOKTA) {
      // Temsilci = kümenin ortalaması (tek bir sapmış fix merkezi az kaydırır;
      // medyan daha sağlam olurdu ama iki eksende medyan noktayı küme dışına
      // düşürebiliyor — ortalama burada yeterli ve öngörülebilir).
      const n = kume.length;
      const lat = kume.reduce((a, p) => a + p[0], 0) / n;
      const lng = kume.reduce((a, p) => a + p[1], 0) / n;
      cikti.push([lat, lng]);
    } else {
      cikti.push(...kume);
    }
    kume = [];
  };

  for (let i = 1; i < noktalar.length; i++) {
    // Kümenin İLK noktasına göre ölç: aksi hâlde yavaş sürüklenme (drift)
    // adım adım yarıçapı hiç aşmadan kilometrelerce "duruş" sayılabilir.
    if (metre(kume[0], noktalar[i]) <= DURUS_YARICAP_M) {
      kume.push(noktalar[i]);
    } else {
      kumeyiBosalt();
      kume = [noktalar[i]];
    }
  }
  kumeyiBosalt();
  return cikti;
}

/**
 * Haritaya çizilecek izi hazırla.
 *
 * Sıra önemli: ÖNCE duruş kümeleri toplanır (park titremesi yok olur), SONRA
 * kalan izde sivri ayıklanır. Ters sırada, duruş içindeki sivriler kümeyi
 * bölüp yapay hareket üretebilir.
 *
 * @returns `cizgi` boşsa yol çizilmez; `merkez` her hâlükârda gösterilecek nokta.
 */
export function izHazirla(noktalar: [number, number][]): {
  cizgi: [number, number][];
  merkez: [number, number] | null;
  duruyor: boolean;
} {
  if (noktalar.length === 0) return { cizgi: [], merkez: null, duruyor: true };
  const toplanmis = duruslariTopla(noktalar);
  const temiz = sivrileriAyikla(toplanmis);
  const duruyor = duruyorMu(temiz);
  return {
    cizgi: duruyor ? [] : temiz,
    // Duruyorsa EN SON nokta gösterilir (şoför şu an orada).
    merkez: temiz[temiz.length - 1] ?? noktalar[noktalar.length - 1],
    duruyor,
  };
}
