import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth";
import { evaluateStop } from "@/lib/tracking";
import { maybePrunePings } from "@/lib/retention";
import { trYearMonth } from "@/lib/time";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { haversineKm } from "@/lib/geo";

// Kayma süzgeçleri: GPS oturmadan gelen kaba konum (Wi-Fi/baz, yüzlerce metre
// sapar) ve fiziksel olarak imkânsız sıçramalar KAYDEDİLMEZ — haritada
// "gitmediği yeri gitmiş göster" izlerinin köküydü.
const MAX_ACCURACY_M = 150; // bundan kaba fix'ler çöp
const TELEPORT_WINDOW_SEC = 120; // yalnız taze önceki ping'e karşı bak (yapışma olmasın)
const TELEPORT_SPEED_MPS = 50; // ~180 km/sa üstü = ışınlanma, at

// Şoför konum gönderir; her konumda stay-point durak tespiti çalışır.
export async function POST(req: NextRequest) {
  const u = await getAuthedUser();
  if (!u || u.role !== "DRIVER") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  // Ping seli koruması: normal izleme ~15 sn'de bir; şoför başına 60/dk yeter.
  const rl = rateLimit(`loc:${u.id}`, 60, 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const body = await req.json().catch(() => null);

  // 🔴 TOPLU / GEÇMİŞ ZAMANLI PING (2026-08-08).
  //
  // NEDEN: Tecno/HiOS ön plan servisini ÖLDÜRMÜYOR (bildirim ekranda kalıyor)
  // ama uygulamanın JS tarafını DONDURUYOR. Android bu sırada konumları
  // biriktirip, JS uyanınca `locations` dizisi olarak TOPLU veriyor.
  // Uygulama o dizinin yalnız SON elemanını alıp gerisini atıyordu → şoförün
  // donma boyunca gittiği yol tamamen kayboluyordu ve işletme sahibi haritada
  // DELİK görüyordu ("şoförün nerede kaytardığını nasıl göreyim?").
  //
  // Artık istemci diziyi olduğu gibi gönderebiliyor ve her noktanın KENDİ
  // zamanı yazılıyor — boşluk geriye dönük doluyor.
  //
  // Tek nokta gönderen eski istemciler aynen çalışmaya devam eder.
  type Nokta = { lat: number; lng: number; acc: number | null; t: Date | null };
  const MAX_TOPLU = 200; // tek istekte en fazla; gerisi sonraki uyanışta gelir

  const gecerliNokta = (h: unknown): Nokta | null => {
    const o = h as { lat?: unknown; lng?: unknown; acc?: unknown; t?: unknown };
    const la = Number(o?.lat);
    const ln = Number(o?.lng);
    if (
      !Number.isFinite(la) ||
      !Number.isFinite(ln) ||
      la < -90 ||
      la > 90 ||
      ln < -180 ||
      ln > 180
    )
      return null;
    const a = o?.acc == null ? null : Number(o.acc);
    // Zaman damgası İSTEMCİDEN gelir ama ona körü körüne güvenmeyiz:
    // gelecekte olamaz, 24 saatten eski olamaz (saati bozuk cihaz geçmişi
    // kirletmesin). Geçersizse "şimdi" kabul edilir.
    let t: Date | null = null;
    const ms = Number(o?.t);
    if (Number.isFinite(ms)) {
      const simdi = Date.now();
      if (ms <= simdi + 60_000 && ms >= simdi - 24 * 60 * 60 * 1000) {
        t = new Date(Math.min(ms, simdi));
      }
    }
    return { lat: la, lng: ln, acc: a != null && Number.isFinite(a) ? a : null, t };
  };

  const ham: unknown[] = Array.isArray(body?.points)
    ? body.points.slice(0, MAX_TOPLU)
    : [body];
  const noktalar = ham
    .map(gecerliNokta)
    .filter((n): n is Nokta => n !== null)
    // Kaba fix'ler burada elenir (eski tek-nokta davranışıyla aynı eşik).
    .filter((n) => n.acc == null || n.acc <= MAX_ACCURACY_M)
    // Zaman sırasına diz: ışınlanma süzgeci ve durak tespiti sıraya bağlı.
    .sort((a, b) => (a.t?.getTime() ?? 0) - (b.t?.getTime() ?? 0));

  if (noktalar.length === 0) {
    // Hiç geçerli nokta yok: gövde bozuksa 400, yalnız hassasiyetten elendiyse
    // 200 (eski davranış — istemci bunu hata sanıp yeniden denememeli).
    const bozuk = ham.every((h) => gecerliNokta(h) === null);
    return bozuk
      ? NextResponse.json({ error: "Geçersiz konum" }, { status: 400 })
      : NextResponse.json({ ok: true, skipped: "accuracy" });
  }

  const driver = await prisma.driver.findUnique({ where: { userId: u.id } });
  if (!driver) {
    return NextResponse.json({ error: "Şoför yok" }, { status: 404 });
  }

  try {
  const last = await prisma.driverLocationPing.findFirst({
    where: { driverId: driver.id },
    orderBy: { recordedAt: "desc" },
  });

  // Noktalar ZAMAN SIRASINA göre tek tek işlenir: hem ışınlanma süzgeci hem
  // durak tespiti "önceki nokta"ya bağlı olduğu için toplu yazım yapılamaz.
  let oncekiLat = last?.lat ?? null;
  let oncekiLng = last?.lng ?? null;
  let oncekiAn = last?.recordedAt ?? null;
  let yazilan = 0;
  let atlanan = 0;

  for (const n of noktalar) {
    const an = n.t ?? new Date();

    // Işınlanma süzgeci: taze bir önceki ping varken imkânsız hız = sapmış fix.
    // Eski ping'e karşı bakılmaz — yanlış kayıt sonrası doğru konuma "yapışıp"
    // her yeni fix'i reddetme durumu oluşmasın.
    if (oncekiLat != null && oncekiLng != null && oncekiAn) {
      const dtSec = (an.getTime() - oncekiAn.getTime()) / 1000;
      if (dtSec >= 0 && dtSec < TELEPORT_WINDOW_SEC) {
        const distM = haversineKm(oncekiLat, oncekiLng, n.lat, n.lng) * 1000;
        if (distM / Math.max(dtSec, 1) > TELEPORT_SPEED_MPS) {
          atlanan++;
          continue;
        }
      }
    }

    await prisma.driverLocationPing.create({
      data: { driverId: driver.id, lat: n.lat, lng: n.lng, recordedAt: an },
    });
    yazilan++;

    // Durak tespiti her nokta için çalışır — geriye dönük yüklenen izde de
    // duraklar doğru çıksın (halıcı "nerede ne kadar bekledi" görecek).
    const openStop = await prisma.driverStop.findFirst({
      where: { driverId: driver.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    const action = evaluateStop({
      openStop: openStop
        ? { lat: openStop.lat, lng: openStop.lng, startedAt: openStop.startedAt }
        : null,
      lastPing:
        oncekiLat != null && oncekiLng != null && oncekiAn
          ? { lat: oncekiLat, lng: oncekiLng, recordedAt: oncekiAn }
          : null,
      lat: n.lat,
      lng: n.lng,
      now: an,
    });

    if (action.type === "open") {
      const period = trYearMonth(action.startedAt); // TR ayına yaz (A9)
      await prisma.driverStop.create({
        data: {
          driverId: driver.id,
          lat: action.lat,
          lng: action.lng,
          startedAt: action.startedAt,
          durationSec: 0, // yeni durak sıfırdan başlar; extend doğru hesaplar (D5)
          periodYear: period.year,
          periodMonth: period.month,
        },
      });
    } else if (action.type === "extend" && openStop) {
      await prisma.driverStop.update({
        where: { id: openStop.id },
        data: { durationSec: action.durationSec },
      });
    } else if (action.type === "finalize" && openStop) {
      await prisma.driverStop.update({
        where: { id: openStop.id },
        data: { endedAt: action.endedAt, durationSec: action.durationSec },
      });
    } else if (action.type === "discard" && openStop) {
      await prisma.driverStop.delete({ where: { id: openStop.id } });
    }

    oncekiLat = n.lat;
    oncekiLng = n.lng;
    oncekiAn = an;
  }

  if (yazilan === 0) {
    return NextResponse.json({ ok: true, skipped: "teleport", atlanan });
  }

  // Canlı konum = kabul edilen EN YENİ nokta. `lastSeenAt` yalnız burada
  // yazılır (2026-08-08: mesai ucu artık yazmıyor — bkz. api/driver/shift).
  await prisma.driver.update({
    where: { id: driver.id },
    data: {
      lastLat: oncekiLat!,
      lastLng: oncekiLng!,
      lastSeenAt: oncekiAn!,
    },
  });

  // Eski ping'leri ara sıra temizle (sınırsız büyümeyi engelle) — yanıtı bekletme.
  void maybePrunePings();

  return NextResponse.json({ ok: true, yazilan, atlanan });
  } catch (e) {
    console.error("driver/location hatası:", e);
    return NextResponse.json({ error: "Konum kaydedilemedi" }, { status: 500 });
  }
}
