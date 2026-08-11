import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPanelBusiness } from "@/lib/panel";
import { STOP_MIN_SEC } from "@/lib/tracking";
import { trDayBoundsUTC } from "@/lib/time";
import { izHazirla } from "@/lib/konumFiltre";
import { yollaraOturt } from "@/lib/yolaOturt";
import { haversineKm } from "@/lib/geo";

// YOLLARA OTURTMA ÖNBELLEĞİ (2026-08-07 gecesi).
// Aynı şoför-gün her sayfa açılışında yeniden oturtulmasın: iz DEĞİŞMEDİĞİ
// sürece (nokta sayısı aynı) sonuç aynıdır. Bellek içi, tek instance için
// yeterli — geocode önbelleğiyle aynı desen (lib/geocode).
const oturtmaOnbellek = new Map<string, { veri: [number, number][][]; zaman: number }>();
const ONBELLEK_TTL_MS = 30 * 60 * 1000;
const ONBELLEK_MAX = 200;

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % step === 0);
}

// Bir şoförün belirli bir güne ait kayıtlı rotası (çizgi + duraklar + dakika)
export async function GET(req: NextRequest) {
  const b = await getPanelBusiness();
  if (!b) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const driverId = sp.get("driverId");
  if (!driverId || !b.drivers.some((d) => d.id === driverId)) {
    return NextResponse.json({ error: "Şoför bulunamadı" }, { status: 404 });
  }

  const dateStr = sp.get("date"); // YYYY-MM-DD (TR günü)
  if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
  }
  const { start: gunBas, end: gunBit } = trDayBoundsUTC(dateStr ?? undefined);

  // SAAT ARALIĞI (2026-08-11, işletme sahibi: "istediği saat aralığına
  // bakabilsin"). Gün boyu iz tek ekranda karışıyor; 14:00-16:00 arası
  // sorulduğunda gün geneli cevap vermiyor.
  //
  // ⚠️ TR saatine göre: gün sınırı zaten TR'ye göre hesaplanıyor, saatler de
  // onun üstüne ekleniyor. Sunucu UTC'de çalıştığı için ham saat eklemek
  // aralığı 3 saat kaydırırdı.
  const saatOku = (ham: string | null, varsayilan: number): number | null => {
    if (ham == null || ham === "") return varsayilan;
    if (!/^\d{1,2}$/.test(ham)) return null;
    const n = Number(ham);
    return n >= 0 && n <= 24 ? n : null;
  };
  const bas = saatOku(sp.get("bas"), 0);
  const bit = saatOku(sp.get("bit"), 24);
  if (bas == null || bit == null || bas >= bit) {
    return NextResponse.json({ error: "Geçersiz saat aralığı" }, { status: 400 });
  }
  const start = new Date(gunBas.getTime() + bas * 3600_000);
  // Gün sonunu aşma: 24 verilirse günün kendi sınırı kullanılır.
  const end = new Date(Math.min(gunBas.getTime() + bit * 3600_000, gunBit.getTime()));

  const [pings, stops] = await Promise.all([
    prisma.driverLocationPing.findMany({
      where: { driverId, recordedAt: { gte: start, lt: end } },
      orderBy: { recordedAt: "asc" },
      select: { lat: true, lng: true, recordedAt: true },
    }),
    prisma.driverStop.findMany({
      where: {
        driverId,
        startedAt: { gte: start, lt: end },
        durationSec: { gte: STOP_MIN_SEC }, // sadece gerçek duraklar
      },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  // BOŞSA NEDENİNİ SÖYLE (2026-07-27): eskiden yalnız "konum kaydı yok" yazıyordu
  // ve halıcı bunun sebebini (şoför mesaiye çıkmadı mı, uygulamayı hiç açmadı mı,
  // yanlış gün mü seçildi) anlayamıyordu. Teşhis için iki ek bilgi topluyoruz:
  // şoförün ŞU AN mesai durumu ve EN SON ne zaman konum gönderdiği.
  let tani: {
    hicKayitYok: boolean;
    sonKayit: string | null;
    mesaide: boolean;
    gelecekGun: boolean;
  } | null = null;
  if (pings.length === 0) {
    const [sonPing, sofor] = await Promise.all([
      prisma.driverLocationPing.findFirst({
        where: { driverId },
        orderBy: { recordedAt: "desc" },
        select: { recordedAt: true },
      }),
      prisma.driver.findUnique({
        where: { id: driverId },
        select: { isOnShift: true },
      }),
    ]);
    tani = {
      hicKayitYok: sonPing == null,
      sonKayit: sonPing?.recordedAt.toISOString() ?? null,
      mesaide: sofor?.isOnShift ?? false,
      gelecekGun: start.getTime() > Date.now(),
    };
  }

  // 🔴 SİVRİ AYIKLAMA (2026-08-06). Ham ping'ler DEĞİŞMEDEN saklanıyor;
  // yalnız haritaya çizilen dizi süzülüyor. Tek sapmış fix "gidip gelmiş"
  // gibi koca bir yol üretiyordu (kullanıcı: "şoför evden hiç çıkmadı ama
  // harita yol çizdi"). Şoför gerçekten dar bir kümede kaldıysa çizgi HİÇ
  // çizilmez — gürültü "gezinti" gibi görünmesin (bkz. lib/konumFiltre.ts).
  // ⚠️ ZAMAN DAMGASI ŞART (2026-08-07 akşam): süzgeç artık hıza bakıyor; `t`
  // verilmezse yavaş sürüklenme ile yavaş sürüş ayırt edilemez.
  const hamNoktalar = pings.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    t: p.recordedAt.getTime(),
  }));
  const { cizgi, parcalar, duruyor } = izHazirla(hamNoktalar);
  const points = downsample(cizgi, 500);
  // KOPUK PARÇALAR (2026-08-07 akşam): harita boşlukta çizgi çizmesin.
  // `points` (düz dizi) oynatma ve çerçeveleme için duruyor; ÇİZGİ bundan
  // çiziliyor. Ölçüm: tek şoförün tek gününde 3 dk'dan uzun 47 boşluk vardı.
  let parcalarKucuk = parcalar.map((p) => downsample(p, 500));

  // 🔴 YOLLARA OTURT — "şoförün nereye gittiği belli mi?" sorusunun cevabı.
  // Yalnız PARÇA İÇİNDE; kopukluk üzerinden yol uydurulmaz (lib/yolaOturt.ts).
  // OSRM kapalıysa/yavaşsa ham iz çizilir — harita boş kalmaz.
  // ⚠️ SAAT ARALIĞI ANAHTARA GİRMELİ (2026-08-11): girmezse 09-12 aralığı için
  // hesaplanan oturtma, aynı gün 14-16 sorulduğunda ping SAYISI da denk gelirse
  // yanlışlıkla geri döner. Sessiz ve tespiti zor bir hata olurdu.
  const anahtar = `${driverId}|${dateStr ?? "bugun"}|${bas}-${bit}|${pings.length}`;
  const vurus = oturtmaOnbellek.get(anahtar);
  if (vurus && Date.now() - vurus.zaman < ONBELLEK_TTL_MS) {
    parcalarKucuk = vurus.veri;
  } else if (parcalarKucuk.length) {
    parcalarKucuk = await yollaraOturt(parcalarKucuk);
    if (oturtmaOnbellek.size >= ONBELLEK_MAX) {
      const ilk = oturtmaOnbellek.keys().next().value;
      if (ilk !== undefined) oturtmaOnbellek.delete(ilk);
    }
    oturtmaOnbellek.set(anahtar, { veri: parcalarKucuk, zaman: Date.now() });
  }
  const stopRows = stops.map((s) => ({
    lat: s.lat,
    lng: s.lng,
    address: s.address,
    startedAt: s.startedAt,
    durationMin: Math.round((s.durationSec ?? 0) / 60),
  }));
  const totalStopMin = stopRows.reduce((a, s) => a + s.durationMin, 0);

  // 🔴 DELİK SAYIMI (2026-08-11) — "bilmiyorum" ile "durdu"yu AYIR.
  //
  // İşletme sahibi haritadaki kopukluğu sorunca ölçüldü: aynı gün 34, 38 ve
  // 52 dakikalık üç boşluk vardı ve panel bunları hiçbir yerde SÖYLEMİYORDU.
  // Daha kötüsü, boşluğun iki ucu aynı noktadaysa süre "durak" olarak
  // yutuluyor ve halıcıya "şoför 47 dk durakladı" diye gösteriliyor — oysa
  // bilinen tek şey uygulamanın susduğu. Bu, maaş kesintisine kadar gidebilecek
  // bir iddia; ölçülmeden ekrana yazılmamalı.
  //
  // İKİ AYRI SAYI, KARIŞTIRMA:
  //  · `delikSayisi` / `bilinmeyenDk` — akışın sustuğu her boşluk.
  //  · `kopukSayisi` — iki ucu BİRBİRİNDEN UZAK olan boşluk; yalnız bunlarda
  //    şoförün nerede olduğu gerçekten bilinmiyor ve harita çizgiyi koparıyor
  //    (aynı eşikler: lib/konumFiltre.ts BOSLUK_SN/BOSLUK_M).
  const DELIK_SN = 180;
  const KOPUK_M = 200;
  let delikSayisi = 0;
  let bilinmeyenSn = 0;
  let enUzunDelikSn = 0;
  let kopukSayisi = 0;
  for (let i = 1; i < pings.length; i++) {
    const sn = (pings[i].recordedAt.getTime() - pings[i - 1].recordedAt.getTime()) / 1000;
    if (sn <= DELIK_SN) continue;
    delikSayisi++;
    bilinmeyenSn += sn;
    if (sn > enUzunDelikSn) enUzunDelikSn = sn;
    const m =
      haversineKm(pings[i - 1].lat, pings[i - 1].lng, pings[i].lat, pings[i].lng) * 1000;
    if (m > KOPUK_M) kopukSayisi++;
  }

  return NextResponse.json({
    points,
    parcalar: parcalarKucuk,
    // Şoför gün boyu tek noktada kaldıysa arayüz "yol yok" yerine bunu
    // açıklayabilsin; boş `points` tek başına "veri yok" gibi okunuyordu.
    duruyor,
    stops: stopRows,
    tani,
    // Seçili aralık — arayüz "gün geneli mi, dilim mi" diye tahmin etmesin.
    aralik: { bas, bit },
    summary: {
      pingCount: pings.length,
      stopCount: stopRows.length,
      totalStopMin,
      delikSayisi,
      bilinmeyenDk: Math.round(bilinmeyenSn / 60),
      enUzunDelikDk: Math.round(enUzunDelikSn / 60),
      kopukSayisi,
    },
  });
}
