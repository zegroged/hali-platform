// GÜN SONU TAHSİLAT MUTABAKATI (2026-07-29).
//
// NEDEN AYRI DOSYA: buradaki hesap SAF — veritabanı, oturum, tarih "şu an"
// bilgisi almaz; girdisi verilir, çıktısı hesaplanır. Böylece Docker/DB
// olmadan birim testiyle doğrulanabiliyor (scripts/test-tahsilat.mjs).
// Paranın konuşulduğu yerde "derlendi, herhalde çalışıyor" yetmez.
//
// ⚠️ KASA İLE KARIŞTIRILMAMALI — EN SİNSİ TUZAK BU:
// Kasa (lib/ledger.ts) TAHAKKUK defteridir: teslim edilmiş siparişlerin
// priceTotal toplamını CANLI hesaplar, LedgerEntry satırı YAZMAZ.
// Mutabakat ise NAKİT görünümüdür: elime ne geçti?
// Buradan Kasa'ya INCOME satırı YAZILMAZ — yazılırsa aynı para hem canlı
// toplamda hem elle girilen gelirde sayılır ve halıcı iki farklı "bu ay ne
// kazandım" rakamı görür. İkisi ayrı ekranda, ayrı etiketle durur.

/** Mutabakat hesabına giren tek bir teslim edilmiş sipariş. */
export type TeslimKaydi = {
  orderId: string;
  /** Teslim eden şoför (panelden halıcı teslim ettiyse null). */
  driverId: string | null;
  driverName: string | null;
  /** Teslimde yazılan tutar (tahsil edilmiş olsun olmasın). */
  tutar: number;
  /** Tahsil edildi mi — teslim edenin BEYANI. */
  tahsilEdildi: boolean;
  /** "CASH" | "IBAN" — IBAN sofurun uzerinde nakit BIRAKMAZ. */
  yontem?: string | null;
};

/** Şoförün halıcıya elden verdiği nakit. */
export type NakitDevri = {
  driverId: string | null;
  tutar: number;
};

export type SoforSatiri = {
  driverId: string | null;
  driverName: string;
  teslimat: number;
  /** Tahsil edilen toplam (nakit + IBAN). */
  tahsilat: number;
  /** Bunun IBAN/havale ile geleni — banka hesabinda, soforde DEGIL. */
  ibanTahsilat: number;
  /** Teslim edilip TAHSİL EDİLMEYEN toplam (kurumsal/veresiye). */
  tahsilEdilmeyen: number;
  /** Halıcıya devredilen nakit. */
  devredilen: number;
  /** Şoförün üzerinde bekleyen nakit = tahsilat − devredilen. */
  bekleyen: number;
};

export type MutabakatOzeti = {
  satirlar: SoforSatiri[];
  toplamTeslimat: number;
  toplamTahsilat: number;
  toplamIbanTahsilat: number;
  toplamTahsilEdilmeyen: number;
  toplamDevredilen: number;
  toplamBekleyen: number;
};

/** Kuruş hatası birikmesin: para toplamları 2 haneye yuvarlanır. */
function kurus(n: number): number {
  return Math.round(n * 100) / 100;
}

const PANEL = "__panel__"; // şoförsüz (halıcının kendi teslimi) satırın anahtarı

/**
 * Gün sonu mutabakatı: kim ne teslim etti, ne tahsil etti, üzerinde ne kaldı.
 *
 * `devirler` AYNI döneme ait olmalı — çağıran filtreler. Devir kaydı olan ama
 * o gün teslimatı olmayan şoför de satırda görünür (parayı dün toplayıp bugün
 * getirmiş olabilir); aksi hâlde devir "kaybolur" ve bakiye yanlış çıkar.
 */
export function mutabakatHesapla(
  teslimler: TeslimKaydi[],
  devirler: NakitDevri[],
): MutabakatOzeti {
  const harita = new Map<string, SoforSatiri>();

  const satirAl = (driverId: string | null, ad: string | null): SoforSatiri => {
    const anahtar = driverId ?? PANEL;
    let s = harita.get(anahtar);
    if (!s) {
      s = {
        driverId,
        driverName: ad ?? (driverId ? "Bilinmeyen şoför" : "Panelden (halıcı)"),
        teslimat: 0,
        tahsilat: 0,
        ibanTahsilat: 0,
        tahsilEdilmeyen: 0,
        devredilen: 0,
        bekleyen: 0,
      };
      harita.set(anahtar, s);
    }
    // Ad sonradan gelirse (devir kaydında var, teslimde yok) doldur.
    if (ad && s.driverName !== ad && s.driverId) s.driverName = ad;
    return s;
  };

  for (const t of teslimler) {
    const s = satirAl(t.driverId, t.driverName);
    s.teslimat += 1;
    const tutar = Number.isFinite(t.tutar) ? t.tutar : 0;
    if (t.tahsilEdildi) {
      s.tahsilat = kurus(s.tahsilat + tutar);
      // IBAN ise ayri sayilir: bakiyeden dusulecek cunku banka hesabinda.
      if (t.yontem === "IBAN") s.ibanTahsilat = kurus(s.ibanTahsilat + tutar);
    } else s.tahsilEdilmeyen = kurus(s.tahsilEdilmeyen + tutar);
  }

  for (const d of devirler) {
    const s = satirAl(d.driverId, null);
    const tutar = Number.isFinite(d.tutar) ? d.tutar : 0;
    s.devredilen = kurus(s.devredilen + tutar);
  }

  const satirlar = [...harita.values()].map((s) => ({
    ...s,
    // BEKLEYEN YALNIZ NAKITTEN: IBAN parasi zaten hesapta, soforde degil.
    bekleyen: kurus(s.tahsilat - s.ibanTahsilat - s.devredilen),
  }));

  // Sıralama: üzerinde en çok para bekleyen üstte — halıcının bakacağı şey bu.
  satirlar.sort((a, b) => b.bekleyen - a.bekleyen);

  return {
    satirlar,
    toplamTeslimat: satirlar.reduce((t, s) => t + s.teslimat, 0),
    toplamTahsilat: kurus(satirlar.reduce((t, s) => t + s.tahsilat, 0)),
    toplamIbanTahsilat: kurus(satirlar.reduce((t, s) => t + s.ibanTahsilat, 0)),
    toplamTahsilEdilmeyen: kurus(
      satirlar.reduce((t, s) => t + s.tahsilEdilmeyen, 0),
    ),
    toplamDevredilen: kurus(satirlar.reduce((t, s) => t + s.devredilen, 0)),
    toplamBekleyen: kurus(satirlar.reduce((t, s) => t + s.bekleyen, 0)),
  };
}

/**
 * Gün aralığı — Europe/Istanbul.
 *
 * NEDEN ELLE: sunucu konteynerinde TZ tanımlı değil (UTC). `new Date()` ile
 * "bugün" alınırsa 00:00–03:00 arasındaki teslimatlar BİR ÖNCEKİ güne düşer
 * ve halıcı sabah "dün 3 teslimat eksik" der. Panelin diğer sayfalarında da
 * aynı düzeltme yapıldı (bkz. panel/mesajlar).
 *
 * TR yaz saati uygulamıyor: 2016'dan beri sabit UTC+3.
 */
export function gunAraligi(gunISO: string): { bas: Date; son: Date } {
  const [y, a, g] = gunISO.split("-").map(Number);
  // TR günü 00:00 = UTC 21:00 (önceki gün)
  const bas = new Date(Date.UTC(y, a - 1, g, 0, 0, 0) - 3 * 60 * 60 * 1000);
  const son = new Date(bas.getTime() + 24 * 60 * 60 * 1000);
  return { bas, son };
}

/** "2026-07-29" — Europe/Istanbul gününe göre. */
export function bugunISO(simdi: Date): string {
  const tr = new Date(simdi.getTime() + 3 * 60 * 60 * 1000);
  return tr.toISOString().slice(0, 10);
}

/**
 * 🔴 TESLİM OLAY NOTU — TEK KAYNAK (2026-08-11).
 *
 * ÖNCESİ: not `paymentMethod === "CASH"` ile seçiliyordu, oysa asıl soru
 * "para ALINDI MI". Şoför **"Almadım (sonra ödeyecek)"** seçse bile geçmişe
 * *"1.250 TL nakit tahsil edildi"* yazılıyordu — üstelik `paymentStatus`
 * PAID OLMUYORDU. Yani sipariş geçmişi ile ödeme durumu birbirini
 * yalanlıyordu. IBAN seçimi de "nakit" diye kaydediliyordu.
 *
 * Bu kayıt ispat belgesi: halıcı mutabakatta bunu okuyor, uyuşmazlıkta
 * dayanılan iz bu. Yalan yazması kabul edilemez.
 *
 * NEDEN ORTAK FONKSİYON: aynı metin İKİ yerde ayrı ayrı kuruluyordu
 * (app/sofor/actions.ts ve lib/driverOrders.ts) ve ikisi de aynı hatayı
 * taşıyordu. Bu depoda ikiz mantık ayrıştırması defalarca pahalıya patladı;
 * metin tek yerden üretilirse bir daha ayrışamaz.
 */
export function teslimNotu(
  tutar: number,
  kartla: boolean,
  tahsilEdildi: boolean,
  yontem?: string | null,
): string {
  // ⚠️ BU METİN MÜŞTERİYE GÖRÜNÜR. Zincir: OrderEvent.note →
  // api/orders/[token] → TrackingClient (herkese açık /takip sayfası).
  // İlk yazımda "TAHSİL EDİLMEDİ (şoför 'almadım' dedi)" ve "şoförde nakit
  // YOK" yazıyordu; ikisi de iç kasa bilgisi, üstelik ilki meşru vadeli
  // müşteriyi tırnak içinde suçluyordu. Doğrulama denetimi yakaladı.
  // Kural: not, DOĞRUYU söylesin ama müşteriye söylenebilir olsun.
  const bas = `Teslim edildi · ${tlYaz(tutar)}`;
  if (kartla) return `${bas} (kartla ödeme bekleniyor)`;
  if (!tahsilEdildi) return `${bas} (ödeme bekleniyor)`;
  return yontem === "IBAN"
    ? `${bas} (havale/EFT ile ödendi)`
    : `${bas} nakit tahsil edildi`;
}

/** "1250.5" → "1.250,50 TL". Ham JS sayısı ekrana basılmasın. */
function tlYaz(n: number): string {
  const tam = Math.trunc(Math.abs(n));
  const kurus = Math.round((Math.abs(n) - tam) * 100);
  const tamNokta = String(tam).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const isaret = n < 0 ? "-" : "";
  return kurus === 0
    ? `${isaret}${tamNokta} TL`
    : `${isaret}${tamNokta},${String(kurus).padStart(2, "0")} TL`;
}
