// Abonelik paketi TEK yerde tanımlanır — /abonelik sayfası ve /kayit funnel'ı
// aynı kaynağı okur; fiyat/kapsam değişince iki sayfa birden güncel kalır.
// (Fiyat sözleşmeyle uyumlu olmalı: isletme-sozlesmesi §3.)
// ÜCRETSİZ DENEME YOK (2026-07-07 kararı): abonelik ödemeyle başlar,
// ödemesi alınmayan işletme yayına alınmaz. Fiyat KDV HARİÇ anılır
// (kartta "₺2.000 + KDV / ay"), sözleşme §3 ile birebir aynı.
// MERDİVEN ANAHTARI BURADA TANIMLI, config.ts'te DEĞİL — config.ts bu dosyadan
// `PLAN_TUTARLARI` alıyor, ters yönde import döngü yaratırdı. `config.ts` bunu
// yeniden dışa veriyor, mevcut `import { merdivenAktif } from "@/lib/config"`
// satırlarının hepsi çalışmaya devam ediyor.
// İKİ DEĞİŞKEN, TEK ANLAM. Sunucu tarafı `FIYAT_MERDIVENI` ile çalışır (çalışma
// zamanında okunur, .env yeter). Ama `/kayit` bir CLIENT COMPONENT ve istemci
// paketinde yalnız `NEXT_PUBLIC_*` değişkenleri bulunur — diğerleri `undefined`
// olur. O yüzden istemci tarafı için build arg'ı olan ikizi gerekiyor
// (Dockerfile + compose build.args; Google Maps anahtarıyla aynı desen).
// ⚠️ İKİSİ BİRLİKTE SET EDİLMELİ; yalnız biri açılırsa sözleşme 900 derken
// kayıt formu 2.000 gösterir.
export const merdivenAktif =
  process.env.FIYAT_MERDIVENI === "1" ||
  process.env.NEXT_PUBLIC_FIYAT_MERDIVENI === "1";

export const PLAN = {
  name: "İşletme Aboneliği",
  // Merdiven açıkken görünen fiyat TABAN basamaktır (1 şoför): 750 + KDV = 900.
  // Ek şoför ve tavan bilgisi kartın kendisinde ayrıca yazılır (PlanCard).
  priceAmount: merdivenAktif ? "750" : "2.000",
  priceMonthly: merdivenAktif ? "750 TL + KDV" : "2.000 TL + KDV",
  kdvRate: 20,
  priceNetMonthly: merdivenAktif ? "750,00" : "2.000,00",
  kdvMonthly: merdivenAktif ? "150,00" : "400,00",
  priceGrossMonthly: merdivenAktif ? "900,00" : "2.400,00",
  // iyzico'ya gönderilen KDV DAHİL sayısal tutar (tahsil edilen). Görünen
  // metinlerle (yukarısı) tutarlı olmalı.
  priceGrossNumber: merdivenAktif ? 900 : 2400,
  // SIRA KASITLIDIR (2026-07-29). Bu liste halıcının PARAYI ÖDERKEN gördüğü
  // "pakete dahil olanlar"dı ve ilk iki maddesi görünürlük/sipariş vaadiydi —
  // yani bedelin karşılığı müşteri olarak ilan ediliyordu. Canlıda tüm
  // zamanlarda 3 teslim edilmiş sipariş, 0 yorum var. Artık önce çalışan
  // yazılım sayılıyor; keşifte listelenme taahhütsüz biçimde sonda.
  // KASA listede HİÇ YOKTU — panelde çalışan bir defter satılmadan duruyordu.
  // 2026-08-03: liste ürünün GELDİĞİ yeri anlatmıyordu — Halı Bul, WhatsApp
  // bildirimleri, mutabakat ve gelen kutusu hiç geçmiyordu. Dil de kuruydu
  // ("sipariş yönetim paneli"); halıcı özellik değil DERDİNİN ÇÖZÜMÜNÜ okur.
  features: [
    "Sipariş defteri: gelen iş listede durur, tek dokunuşla ilerler — kâğıt, karalama, unutma yok",
    "Müşteriye otomatik WhatsApp ve e-posta: “halım ne oldu?” telefonları kesilir",
    "Kesin fiyat onayı: tutarı sen bildirirsin, müşteri kendi telefonundan onaylar, kayıtta kalır",
    "Alım ve teslimde fotoğraflı kayıt: hasar tartışmasında kanıt sende",
    "Halı Bul: dükkândaki halıların fotoğraf duvarı — hangi halı kimin, numarasıyla belli",
    "Şoför takibi: mesai boyunca canlı konum, dünkü rota, hangi adreste kaç dakika durduğu",
    "Gün sonu mutabakat: şoförün üzerinde ne kadar nakit kaldı, tek ekranda",
    "KASA: gelir-gider defteri, her ay kendiliğinden düşen sabit giderler, kâr-zarar özeti",
    "Dükkâna gelen müşteri için takip kodlu manuel kayıt — sokaktan gelen iş de aynı defterde",
    "Sipariş başına komisyon yok, ciro payı yok, taahhüt yok: istediğin ay bırakırsın",
    "Bölgenin arama ve ilçe sayfasında listelenme — bunun için ayrıca ücret alınmaz",
  ],
} as const;

// ============================================================================
// FİYAT MERDİVENİ (FIYAT-2026-08-09.md kararı) — HENÜZ UYKUDA.
//
// Yukarıdaki PLAN sabiti BİLEREK dokunulmadı: ekranda görünen fiyat, sözleşme
// §3 ile birebir aynı kalmak zorunda ve sözleşme revizyonu + 30 gün bildirim
// tamamlanana kadar 2.400 TL'dir. Aşağısı o gün tek noktadan devreye girecek
// yapıdır; bugün hiçbir yer okumuyor.
//
// KARAR: sabit tek fiyat yerine ŞOFÖR SAYISINA BAĞLI merdiven. Gerekçe ölçüldü —
// düz "sınırsız 900 TL"de ikame sepetinden alınan pay 1 şoförde %51 iken
// 4 şoförde %30'a düşüyordu: en çok değer verilen müşteriden en az para.
// Merdiven her basamakta sepetin ~%55'inde duruyor. Ayrıca maliyet sigortası:
// şoför sayısı sipariş hacminin, sipariş hacmi de WhatsApp giderinin vekilidir.
// ============================================================================

/** Abonelik katmanı. VITRIN kalıcı ücretsizdir (profil + listelenme + sipariş
 *  defteri); ücretli modüller YONETIM'den itibaren açılır. */
export type Paket = "VITRIN" | "YONETIM" | "FILO";

/** KDV DAHİL aylık tutarlar; dizin = faturalanan şoför koltuğu - 1.
 *  4. koltuktan sonra TAVAN: şoför sınırsız, fiyat sabit. */
const MERDIVEN_LISTE = [900, 1200, 1500, 1800] as const;
/** KURUCU listeden BİR BASAMAK aşağıdır (taban 600). Yani "kurucu + 2 şoför"
 *  ile "liste + 1 şoför" aynı tutarı öder — bu yüzden iyzico'da paket başına
 *  değil FİYAT başına plan vardır (bkz. scripts/iyzico-planlar.mjs). */
const MERDIVEN_KURUCU = [600, 900, 1200, 1500] as const;

/** Merdivenin son basamağı: bu koltuk sayısından sonrası ücretsiz (sınırsız). */
export const SOFOR_TAVANI = MERDIVEN_LISTE.length; // 4

/** Pakete dahil aylık WhatsApp konuşması. 150 siparişlik dükkânın üstünde
 *  tutuldu → pratikte kimse aşım görmez, ama taahhüt YAZILIDIR (ucu açık
 *  değişken maliyet ne bütçelenebilir ne de esnafa imzalatılabilir). */
export const DAHIL_KONUSMA = 500;

export type Basamak = {
  /** Faturalanan koltuk sayısı (tavana kelepçelenmiş). */
  koltuk: number;
  /** KDV DAHİL, iyzico'dan çekilen tutar. */
  brut: number;
  /** KDV hariç matrah (komisyon/muhasebe bu tutardan işler). */
  net: number;
  kdv: number;
  /** Tavana dayandı mı — arayüzde "sınırsız şoför" yazmak için. */
  sinirsiz: boolean;
};

const kurus = (n: number) => Math.round(n * 100) / 100;

/** (paket, şoför sayısı, kurucu mu) → o ay tahsil edilecek tutar.
 *  VITRIN her zaman 0'dır; şoför sayısı fiyatı etkilemez çünkü VITRIN'de canlı
 *  konum yoktur. FILO doğrudan tavandan faturalanır. */
export function fiyatBasamagi(
  paket: Paket,
  soforSayisi: number,
  kurucu = false,
): Basamak {
  if (paket === "VITRIN") {
    return { koltuk: 0, brut: 0, net: 0, kdv: 0, sinirsiz: false };
  }
  const basamaklar = kurucu ? MERDIVEN_KURUCU : MERDIVEN_LISTE;
  // FILO = tavan. Aksi hâlde en az 1, en çok SOFOR_TAVANI koltuk faturalanır.
  //
  // ⚠️ SONSUZ TAVANA GİDER, TABANA DEĞİL (denetim bulgusu): önceki hâlde
  // `Number.isFinite(ham) ? ham : 1` yazıyordu, yani Infinity gelirse koltuk 1
  // olup EN UCUZ basamak seçiliyordu. Sayı olmayan girdi (NaN) için 1 doğru
  // varsayılan, ama "sonsuz şoför" için tavan doğrusudur.
  const ham = paket === "FILO" ? SOFOR_TAVANI : Math.trunc(soforSayisi);
  const guvenli = Number.isNaN(ham) ? 1 : ham; // NaN → taban, ±Infinity aşağıda kelepçelenir
  const koltuk = Math.min(Math.max(guvenli, 1), SOFOR_TAVANI);
  const brut = basamaklar[koltuk - 1];
  const net = kurus(brut / (1 + PLAN.kdvRate / 100));
  return { koltuk, brut, net, kdv: kurus(brut - net), sinirsiz: koltuk >= SOFOR_TAVANI };
}

// İKİ MERDİVEN AYNI UZUNLUKTA OLMAK ZORUNDA (denetim bulgusu): kurucu, listenin
// bir basamak aşağısıdır — biri kısalırsa `fiyatBasamagi` tanımsız okur ve
// ekranda NaN fiyat çıkar. Yorumla değil, yükleme anında patlayarak korunuyor.
if (MERDIVEN_LISTE.length !== MERDIVEN_KURUCU.length) {
  throw new Error(
    `Fiyat merdivenleri farklı uzunlukta: liste=${MERDIVEN_LISTE.length} kurucu=${MERDIVEN_KURUCU.length}`,
  );
}

/** Merdivenin tamamı — /abonelik fiyat tablosunu veriden basmak için.
 *  Uzunluk değişmezi yukarıda zorlandığı için hangi diziyi gezdiği artık
 *  önemsiz; yine de niyeti belli olsun diye doğru dizi geziliyor. */
export function merdiven(kurucu = false): Basamak[] {
  const kaynak = kurucu ? MERDIVEN_KURUCU : MERDIVEN_LISTE;
  return kaynak.map((_, i) => fiyatBasamagi("YONETIM", i + 1, kurucu));
}

/**
 * BU İŞLETMEDEN BU AY TAHSİL EDİLECEK BRÜT — kilit dahil.
 *
 * `fiyatBasamagi` yalnız listeyi bilir; kurucu kilidi (`priceGrossLocked`)
 * işletme kaydında durur ve kilit süresi (`priceLockedUntil`) dolana kadar
 * merdivenin ÜSTÜNDEDİR. Bu iki kaynağın hangisinin kazandığı tanımsız
 * kalırsa TÜFE artışından sonra kurucudan yanlış tutar çekilir — sözleşmeye
 * aykırı tahsilat (ETAHS md.16). Öncelik burada TEK yerde tanımlı.
 *
 * Yarım dolu kilit (tutar var, tarih yok) SÜRESİZ kilit sayılır; tersi
 * (tarih var, tutar yok) kilit sayılmaz.
 */
export function tahsilEdilecekBrut(
  paket: Paket,
  soforSayisi: number,
  kilit?: { priceGrossLocked?: unknown; priceLockedUntil?: Date | null } | null,
): number {
  const ham = Number(kilit?.priceGrossLocked ?? Number.NaN);
  const sureli = kilit?.priceLockedUntil ?? null;
  const gecerli =
    Number.isFinite(ham) && ham > 0 && (!sureli || sureli.getTime() > Date.now());
  if (gecerli && paket !== "VITRIN") return ham;
  return fiyatBasamagi(paket, soforSayisi).brut;
}

/** iyzico'da açılmış TÜM plan tutarları (KDV dahil). config.ts bu listeyi
 *  env'deki referans kodlarıyla eşler; buradaki bir tutarın karşılığı yoksa
 *  düzenli ödeme talimatı AÇILMAZ (yarım kurulu tahsilat açılmasın). */
export const PLAN_TUTARLARI = [600, 900, 1200, 1500, 1800] as const;
