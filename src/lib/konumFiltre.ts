// KONUM İZİ AYIKLAMA — ÇİZİM ANINDA (2026-08-06 · yeniden 08-07 · zaman
// farkındalığı 08-07 akşam).
//
// SORUN (kullanıcı, ölçüldü): şoför evden hiç çıkmadı ama Canlı Takip
// haritası uzun bir yol çizdi. Harita ardışık ping'leri düz çizgiyle bağladığı
// için tek bir aykırı nokta "gidip gelmiş" gibi koca bir yol üretiyor.
//
// TEMEL İLKE: ham veri OLDUĞU GİBİ saklanır (kanıt değeri ve KVKK kaydı
// bozulmaz), yalnız haritaya çizilen dizi süzülür. Yanlış bir süzgeç veri
// kaybettirmez; kötü giderse tek satırla geri alınır.
//
// ⚠️ YOLLARA OTURTMA BUNUN YERİNE GEÇMEZ: sapmış nokta yola oturtulunca
// GERÇEK bir sokağa düşer ve harita, şoförün hiç girmediği sokakta düzgünce
// ilerlediğini gösterir — yalan daha inandırıcı olur. Önce ayıklama, sonra
// oturtma (DEVIR §5-B/3).
//
// ───────────────────────────────────────────────────────────────────────────
// 2026-08-07 akşam — ZAMAN FARKINDALIĞI: kalan iki boşluk kapatıldı
//
// DEVIR §5-B/2 iki dürüst boşluk yazıyordu, ikisi de ÖLÇÜMDEN geliyordu:
//   (1) **Ardışık İKİ+ kötü fix** geçiyordu — eski sivri ayıklama yalnız TEK
//       izole noktayı yakalıyordu. GPS sapması genelde tek fix değil, 2-3
//       fix'lik bir demet hâlinde gelir (kapalı mekânda wifi konumlaması
//       birkaç saniye üst üste aynı yanlış yeri söyler).
//   (2) **60 m altında yavaş sürüklenme** geçiyordu — eski duruş kümesi
//       yarıçapa bakıyordu; adım adım 60 m'yi hiç aşmayan sürüklenme
//       kilometrelerce "hareket" olarak çizilebiliyordu.
//
// İKİSİNİN DE KÖKÜ AYNI: süzgeç noktaların ZAMANINI hiç görmüyordu. Nokta
// çiftleri arasındaki süre bilinmeden "duruyor" ile "yavaş gidiyor" ayırt
// edilemez. Artık her nokta `t` (ms) taşıyor ve karar HIZLA veriliyor:
//   · adım < 100 m VE hız < 0,7 m/sn (≈2,5 km/sa) → duruş
//   · üst üste duruş adımları ≥ 3 dk sürüyorsa → tamamı TEK noktaya iner
// Sürüklenme ne kadar uzun sürerse sürsün, her adımı yavaş olduğu için tek
// kümede kalır ve tek noktaya iner. Gerçek sürüş (22-56 km/sa ölçüldü) eşiğin
// 30-80 katı hızdadır, dokunulmaz.
//
// ⚠️ `DURUS_ADIM_M` (100 m) NEDEN ŞART: uygulama gece kapanıp sabah 3 km
// ötede açılırsa iki nokta arası hız 0,07 m/sn çıkar — "yavaş" görünür ama
// duruş DEĞİLDİR. Mesafe kapısı bu tuzağı kapatır: uzun atlama, ne kadar
// yavaş görünürse görünsün, hareket sayılır ve düz çizgi olarak çizilir.
//
// ⚠️ Demo paneli etkilenmez (ölçüldü): demo rotası ~200 m aralıklı 26 nokta —
// adım mesafesi 100 m kapısını aşıyor, hareket sayılıyor.

/** En az enlem/boylam taşıyan her şey. */
export type Konum = { lat: number; lng: number };
/**
 * Zaman damgalı iz noktası. `t` = ms (Date.getTime()).
 *
 * `tBas` yalnız DURUŞ TEMSİLCİLERİNDE dolar: bir duruş kümesi tek noktaya
 * indiğinde `t` kümenin SONU, `tBas` kümenin BAŞLANGICI olur. Sivri ayıklama
 * "kaç saniyede gidip dönmüş" sorusunu sorarken dönüşün gerçekleştiği ana
 * (kümenin başına) bakmalı — kümenin sonuna bakarsa duruşun tamamını yolculuk
 * süresi sanıp gerçek sapmayı ayıklayamaz.
 */
export type IzNoktasi = Konum & { t: number; tBas?: number };

/** İki nokta arası metre (haversine). */
export function metre(a: Konum, b: Konum): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Bir noktanın "sivri" (aykırı) sayılması için komşularından uzaklığı. */
const SIVRI_ESIK_M = 120;
/** Komşuların birbirine bu kadar yakın olması gerekir ki aradaki sivri sayılsın. */
const KOMSU_YAKINLIK_M = 80;
/** Sivri DEMETİ en fazla kaç ardışık nokta olabilir (2026-08-07 akşam). */
const SIVRI_DIZI_MAX = 3;
/** Sivri demeti en fazla kaç saniye sürebilir — gerçek sapma daha uzun sürmez. */
const SIVRI_DIZI_SURE_SN = 240;

/** Duruş kümesi yarıçapı: bu kadar dar alanda kalan iz "duruyor" demektir. */
const DURUS_YARICAP_M = 60;
/** Bir adım bundan uzunsa, ne kadar yavaş görünürse görünsün HAREKETTİR. */
const DURUS_ADIM_M = 100;
/** Bu hızın altı duruş sayılır (0,7 m/sn ≈ 2,5 km/sa — ağır yürüyüşün altı). */
const DURUS_HIZ_MS = 0.7;
/** Bir duruş kümesi sayılmak için gereken en az ardışık nokta. */
const DURUS_MIN_NOKTA = 3;
/** …ya da en az bu kadar süre (sn) — seyrek ping'te 3 nokta birikmeyebilir. */
const DURUS_MIN_SURE_SN = 180;

/**
 * SİVRİ (DEMET) AYIKLAMA — 2026-08-07 akşamı TEK noktadan DEMETE genişletildi.
 *
 * Kural: ardışık 1..3 nokta, HEM kendinden önceki HEM kendinden sonraki
 * noktadan `SIVRI_ESIK_M` uzaksa ve o iki komşu birbirine `KOMSU_YAKINLIK_M`
 * kadar yakınsa → "git-gel" demeti, gerçek hareket değil. Çıkarılır.
 *
 * NEDEN GERÇEK HAREKET ELENMEZ:
 *  · İlerleyen araçta ardışık noktalar sırayla uzaklaşır; başlangıç ile bitiş
 *    noktası birbirine YAKIN OLMAZ (KOMSU_YAKINLIK_M koşulu tutmaz).
 *  · Gerçekten gidip dönen bir şoförün izi 5 sn örneklemede ONLARCA nokta
 *    üretir — 3 noktalık tavan onu korur.
 *  · Süre kapısı (240 sn) ek güvence: gerçek bir sokak turu bundan uzun sürer.
 */
export function sivrileriAyikla(noktalar: IzNoktasi[]): IzNoktasi[] {
  if (noktalar.length < 3) return noktalar;
  const cikti: IzNoktasi[] = [noktalar[0]];
  let i = 1;
  while (i < noktalar.length - 1) {
    const onceki = cikti[cikti.length - 1];
    let atlandi = 0;
    for (let uzunluk = 1; uzunluk <= SIVRI_DIZI_MAX; uzunluk++) {
      const sonraki = noktalar[i + uzunluk];
      if (!sonraki) break;
      if (metre(onceki, sonraki) >= KOMSU_YAKINLIK_M) continue;
      // İKİ SÜRE KAPISI:
      //  · gidip-dönme süresi: şoför GERÇEKTEN uzaklaşıp döndüyse ve elimizde
      //    yalnız 1-3 nokta varsa (seyrek veri), izi silmemeliyiz.
      //  · demetin KENDİ süresi: sapma demeti saniyeler sürer, gerçek tur değil.
      const donusT = sonraki.tBas ?? sonraki.t;
      if ((donusT - onceki.t) / 1000 > SIVRI_DIZI_SURE_SN) break;
      const demetSn = (noktalar[i + uzunluk - 1].t - noktalar[i].t) / 1000;
      if (demetSn > SIVRI_DIZI_SURE_SN) break;
      let hepsiUzak = true;
      for (let k = i; k < i + uzunluk; k++) {
        if (
          metre(onceki, noktalar[k]) <= SIVRI_ESIK_M ||
          metre(noktalar[k], sonraki) <= SIVRI_ESIK_M
        ) {
          hepsiUzak = false;
          break;
        }
      }
      if (hepsiUzak) {
        atlandi = uzunluk;
        break;
      }
    }
    if (atlandi) {
      i += atlandi; // demet komple atlanır
    } else {
      cikti.push(noktalar[i]);
      i++;
    }
  }
  cikti.push(noktalar[noktalar.length - 1]);
  return cikti;
}

/**
 * DURUYOR MU? — TÜM iz dar bir kümede mi.
 *
 * ⚠️ Bu YALNIZ "gün boyu hiç kıpırdamadı" durumunu yakalar. Gün içinde hem
 * duran hem gezen normal bir şoförde ASLA tetiklenmez. Asıl iş
 * `duruslariTopla`'da — bu fonksiyon yalnız "hiç hareket yok" özel durumu
 * için duruyor (arayüz "yol yok" yerine sebebini yazabilsin).
 */
export function duruyorMu(noktalar: Konum[]): boolean {
  if (noktalar.length < 2) return true;
  const ilk = noktalar[0];
  for (const n of noktalar) {
    if (metre(ilk, n) > DURUS_YARICAP_M) return false; // erken çık
  }
  return true;
}

/**
 * 🔴 DURUŞ KÜMELERİNİ TEK NOKTAYA İNDİR — ASIL DÜZELTME.
 *
 * NEDEN İKİ KEZ YENİDEN YAZILDI:
 *  · 1. sürüm (08-06) duruşu **tüm ize** bakarak arıyordu; gerçek veriyle
 *    sınanınca 325 noktanın yalnız 9'unu eledi — iz hem sürüş hem duruş
 *    içeriyordu, "tümü dar mı" sorusu hiç tutmuyordu.
 *  · 2. sürüm (08-07) ardışık noktaları 60 m yarıçapında kümeledi; park
 *    titremesini çözdü ama **yavaş sürüklenme** yarıçapı adım adım aşıp
 *    kaçıyordu (DEVIR §5-B/2'de dürüstçe yazılıydı).
 *  · 3. sürüm (08-07 akşam, bu) HIZA bakıyor: küme, adım YAVAŞ olduğu sürece
 *    büyür. Sürüklenme ne kadar sürerse sürsün her adımı yavaştır → tek
 *    kümede kalır → tek noktaya iner. Yarıçap kapısı yok, dolayısıyla
 *    "yavaşça 500 m kayma" da yakalanır.
 *
 * Gerçek sürüş etkilenmez: ölçülen prod verisinde sürüş adımları 22-56 km/sa
 * (6-15 m/sn), eşik 0,7 m/sn.
 */
export function duruslariTopla(noktalar: IzNoktasi[]): IzNoktasi[] {
  if (noktalar.length < 2) return noktalar;
  const cikti: IzNoktasi[] = [];
  let kume: IzNoktasi[] = [noktalar[0]];

  const kumeyiBosalt = () => {
    const sure = (kume[kume.length - 1].t - kume[0].t) / 1000;
    if (kume.length >= DURUS_MIN_NOKTA || sure >= DURUS_MIN_SURE_SN) {
      // Temsilci = kümenin ortalaması (tek bir sapmış fix merkezi az kaydırır;
      // medyan daha sağlam olurdu ama iki eksende medyan noktayı küme dışına
      // düşürebiliyor — ortalama burada yeterli ve öngörülebilir).
      // ZAMAN = kümenin SONU: bir sonraki adımın hızı buradan hesaplanacak;
      // duruşun başlangıcı yazılırsa kalkış hızı olduğundan yavaş görünür.
      const n = kume.length;
      cikti.push({
        lat: kume.reduce((a, p) => a + p.lat, 0) / n,
        lng: kume.reduce((a, p) => a + p.lng, 0) / n,
        t: kume[n - 1].t,
        tBas: kume[0].tBas ?? kume[0].t,
      });
    } else {
      cikti.push(...kume);
    }
    kume = [];
  };

  for (let i = 1; i < noktalar.length; i++) {
    const onceki = noktalar[i - 1];
    const bu = noktalar[i];
    const mesafe = metre(onceki, bu);
    const saniye = Math.max((bu.t - onceki.t) / 1000, 1);
    // DURUŞ ADIMI: hem kısa hem yavaş. İkisi birden şart —
    //  · yalnız hıza bakılsa, veri boşluğundan sonraki 3 km'lik atlama
    //    "yavaş" görünüp duruş sayılırdı;
    //  · yalnız mesafeye bakılsa (eski sürüm) yavaş sürüklenme kaçardı.
    const durusAdimi = mesafe < DURUS_ADIM_M && mesafe / saniye < DURUS_HIZ_MS;
    if (durusAdimi) {
      kume.push(bu);
    } else {
      kumeyiBosalt();
      kume = [bu];
    }
  }
  kumeyiBosalt();
  return cikti;
}

/** Düğüm: bu yarıçapa sığan bir demet, dar alanda dolanıyor demektir. */
const DUGUM_YARICAP_M = 150;
/** Çizilen yol / net yer değiştirme oranı bunu aşarsa "yol" değil düğümdür. */
const DUGUM_KAT = 3;
/** Bu kadar yol çizilmiyorsa uğraşma (küçük titreme zaten zararsız). */
const DUGUM_MIN_YOL_M = 150;

/**
 * 🔴 DÜĞÜM TOPLAMA (2026-08-07 akşam) — GERÇEK PROD VERİSİNİN ORTAYA ÇIKARDIĞI ÜÇÜNCÜ
 * KUSUR. Sentetik senaryolar bunu göremezdi; ölçüm gösterdi.
 *
 * ÖLÇÜM (prod, 2026-07-16, 128 nokta): şoför 70 dakika boyunca ilk noktadan
 * en fazla 125 m uzaklaşmış — yani HİÇ KIPIRDAMAMIŞ. Buna rağmen harita
 * **508 m** yol çiziyordu. Sebep: mesai açılışındaki İLK 12 SANİYE. GPS
 * otururken fix'ler 1-6 saniye arayla 118 m / 77 m / 101 m / 105 m zıplıyor.
 *  · Hız süzgeci yakalayamaz: 118 m / 6 sn = 19 m/sn — "araç hızı" görünür.
 *  · Sivri ayıklama yakalayamaz: zıplamalar birbirine 44-118 m, ne "komşular
 *    yakın" ne "sapma 120 m'yi aşıyor" koşulu tutar. Kaotik bir demet.
 *
 * DOĞRU SORU FİZİKSEL: 12 saniyede 508 m yol çizip başladığı yerden 121 m
 * ötede bitmek 152 km/sa demek — ve o hızla gidenin 150 m'lik bir dairenin
 * içinde kalması imkânsız. Yani "çizilen yol / net yer değiştirme" oranı,
 * dar bir alanda GÜRÜLTÜNÜN imzasıdır.
 *
 * KURAL: ardışık noktalar `DUGUM_YARICAP_M` içinde kaldığı sürece aynı demet
 * sayılır; demetin çizdiği yol net yer değiştirmesinin `DUGUM_KAT` katından
 * fazlaysa demet TEK noktaya (ortalamaya) iner.
 *
 * GERÇEK ROTA ETKİLENMEZ: yoldan geçen araçta oran ≈1'dir (yol ≈ net mesafe).
 * Demo rotası da güvende (ölçüldü): adımları 236 m, yarıçapa iki nokta bile
 * sığmıyor.
 */
export function dugumleriTopla(noktalar: IzNoktasi[]): IzNoktasi[] {
  if (noktalar.length < 3) return noktalar;
  const cikti: IzNoktasi[] = [];
  let i = 0;
  while (i < noktalar.length) {
    // Demeti büyüt: yeni nokta başlangıç noktasının yarıçapında kaldığı sürece.
    let j = i;
    let yol = 0;
    while (
      j + 1 < noktalar.length &&
      metre(noktalar[i], noktalar[j + 1]) <= DUGUM_YARICAP_M
    ) {
      yol += metre(noktalar[j], noktalar[j + 1]);
      j++;
    }
    const uzunluk = j - i + 1;
    const net = Math.max(metre(noktalar[i], noktalar[j]), 1);
    if (uzunluk >= 3 && yol >= DUGUM_MIN_YOL_M && yol > DUGUM_KAT * net) {
      const dilim = noktalar.slice(i, j + 1);
      cikti.push({
        lat: dilim.reduce((a, p) => a + p.lat, 0) / uzunluk,
        lng: dilim.reduce((a, p) => a + p.lng, 0) / uzunluk,
        t: dilim[uzunluk - 1].t,
        tBas: dilim[0].tBas ?? dilim[0].t,
      });
      i = j + 1;
    } else {
      cikti.push(noktalar[i]);
      i++;
    }
  }
  return cikti;
}

/**
 * Haritaya çizilecek izi hazırla.
 *
 * SIRA ÖNEMLİ — üç kademe, her biri ötekinin göremediğini görür:
 *  1. `duruslariTopla`  — YAVAŞ gürültü (park titremesi, sürüklenme)
 *  2. `dugumleriTopla`  — HIZLI ama dar alanda dolanan gürültü (GPS ısınması)
 *  3. `sivrileriAyikla` — dar alandan FIRLAYIP dönen 1-3 noktalık sapmalar
 *
 * Ters sırada, duruş içindeki sivriler kümeyi bölüp yapay hareket üretebilir.
 * Bu sıra ayrıca kümelenmiş sapmaları da çözer: birbirine yakın 2-3 sapmış
 * fix önce TEK sivriye iner, sonra ayıklanır.
 *
 * @returns `cizgi` boşsa yol çizilmez; `merkez` her hâlükârda gösterilecek nokta.
 */
export function izHazirla(noktalar: IzNoktasi[]): {
  cizgi: [number, number][];
  merkez: [number, number] | null;
  duruyor: boolean;
} {
  if (noktalar.length === 0) return { cizgi: [], merkez: null, duruyor: true };
  const temiz = sivrileriAyikla(dugumleriTopla(duruslariTopla(noktalar)));
  const duruyor = duruyorMu(temiz);
  const son = temiz[temiz.length - 1] ?? noktalar[noktalar.length - 1];
  return {
    cizgi: duruyor ? [] : temiz.map((p) => [p.lat, p.lng] as [number, number]),
    // Duruyorsa EN SON nokta gösterilir (şoför şu an orada). Bu nokta duruş
    // kümesinin ORTALAMASIDIR — yani ham son ping sapmış olsa bile işaretçi
    // şoförü gerçekte durduğu yerde gösterir.
    merkez: [son.lat, son.lng],
    duruyor,
  };
}
