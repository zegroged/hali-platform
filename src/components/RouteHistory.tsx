"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Rota haritası: mobilde 360px, geniş ekranda 480px (PanelTrackingClient ile aynı desen).
const MAP_H = "h-[360px] lg:h-[480px]";

const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => (
    <div
      className={`flex ${MAP_H} items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500`}
    >
      Harita yükleniyor…
    </div>
  ),
});

type Driver = { id: string; name: string };
type Stop = {
  lat: number;
  lng: number;
  address: string | null;
  startedAt: string;
  durationMin: number;
};
// Boş gün TEŞHİSİ (2026-07-27): "kayıt yok" demek yetmiyordu; halıcı sebebini
// bilmek istiyor — şoför mesaiye mi çıkmadı, uygulamayı hiç mi açmadı, yanlış
// gün mü seçildi. Sunucu bu alanları yalnız kayıt sıfırken doldurur.
type Tani = {
  hicKayitYok: boolean;
  sonKayit: string | null;
  mesaide: boolean;
  gelecekGun: boolean;
};
type RouteData = {
  points: [number, number][];
  /** Veri boşluklarında koparılmış iz — çizgi bundan çizilir (2026-08-07 akşam). */
  parcalar?: [number, number][][];
  /** 🔴 2026-08-08: Şoför gün boyu dar bir kümede kaldı → çizgi BİLEREK
   *  çizilmiyor (gürültü "gezinti" gibi görünmesin, 4.64). Sunucu bu bayrağı
   *  ta 2026-08-07'den beri gönderiyordu ama BURADA OKUNMUYORDU: ekran "51
   *  Konum kaydı" ile "Bugün mesaiye çıkılmamış"ı yan yana basıyordu.
   *  (DENETİM md.8b — işletme sahibi sahada yakaladı.) */
  duruyor?: boolean;
  stops: Stop[];
  tani: Tani | null;
  aralik?: { bas: number; bit: number };
  summary: {
    pingCount: number;
    stopCount: number;
    totalStopMin: number;
    /** Akışın 3 dk'dan uzun sustuğu boşluk sayısı. */
    delikSayisi?: number;
    /** O boşlukların toplamı — "bu kadar süre BİLMİYORUZ". */
    bilinmeyenDk?: number;
    enUzunDelikDk?: number;
    /** İki ucu birbirinden uzak boşluk: şoförün nerede olduğu gerçekten meçhul. */
    kopukSayisi?: number;
  };
};

/** Boş günün sebebini halıcının anlayacağı dilde açıkla. */
function bosMesaji(t: Tani | null, tarih: string, bugun: string) {
  if (t?.gelecekGun)
    return {
      baslik: "Bu gün henüz gelmedi",
      aciklama: "İleri bir tarih seçtin. Geçmiş bir gün seç.",
    };
  if (t?.hicKayitYok)
    return {
      baslik: "Bu şoför hiç konum göndermemiş",
      aciklama:
        "Şoför uygulamaya hiç giriş yapmamış ya da konum iznini vermemiş olabilir. Şoförün telefonunda uygulamaya girip mesai düğmesini açması ve konum iznine “Her zaman izin ver” demesi gerekir.",
    };
  const gunAdi = tarih === bugun ? "Bugün" : "Bu gün";
  const son = t?.sonKayit
    ? new Date(t.sonKayit).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
      })
    : null;
  // Mesai AÇIKKEN "mesaiye çıkılmamış" demek kendiyle çelişiyordu (kullanıcı
  // fark etti). Mesai açık + kayıt yok = uygulama konum göndermiyor demektir;
  // başlığı da bunu söylesin, halıcı şoförü arayıp uygulamayı açtırabilsin.
  if (t?.mesaide && tarih === bugun)
    return {
      baslik: "Mesai açık ama konum gelmiyor",
      aciklama:
        (son ? `Bu şoförün en son konum kaydı ${son} tarihinde. ` : "") +
        "Şoför mesaisini açmış ama telefonundan konum düşmüyor — uygulama kapalı olabilir ya da konum izni kapatılmış olabilir. Şoförü arayıp uygulamayı açmasını ve konum iznine “Her zaman izin ver” demesini söyle.",
    };
  return {
    baslik: `${gunAdi} mesaiye çıkılmamış`,
    aciklama:
      (son ? `Bu şoförün en son konum kaydı ${son} tarihinde. ` : "") +
      (t?.mesaide
        ? "Şu an mesaisi açık görünüyor; konum kaydı birkaç dakika içinde düşmeye başlar."
        : "Şoförün mesaisi kapalı. Konum kaydı yalnız şoför uygulamadan mesaiyi açtığında tutulur."),
  };
}

export function RouteHistory({
  drivers,
  today,
}: {
  drivers: Driver[];
  today: string;
}) {
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "");
  const [date, setDate] = useState(today);
  // SAAT ARALIĞI (2026-08-11, işletme sahibi: "istediği saat aralığına
  // bakabilsin"). Gün boyu iz tek ekranda karışıyor; "14:00-16:00 arası
  // neredeydi" sorusuna gün geneli cevap vermiyor.
  const [bas, setBas] = useState(0);
  const [bit, setBit] = useState(24);
  const [data, setData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const stopPlaying = useCallback(() => setPlaying(false), []);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    setPlaying(false);
    const res = await fetch(
      `/api/panel/drivers/route?driverId=${driverId}&date=${date}&bas=${bas}&bit=${bit}`,
    );
    setLoading(false);
    setData(res.ok ? await res.json() : null);
  }, [driverId, date, bas, bit]);

  // KENDİLİĞİNDEN YÜKLE (2026-07-28 kullanıcı isteği: "göster butonuna basmaya
  // gerek olmasın"). Sayfa açılır açılmaz bugünün rotası gelir; şoför ya da
  // tarih değişince de kendiliğinden yenilenir. Buton "Yenile" olarak duruyor —
  // gün içinde tekrar bakmak isteyen için.
  useEffect(() => {
    void load();
  }, [load]);

  const inp = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Rota Geçmişi</h1>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500">Şoför</label>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className={inp}
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Tarih</label>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className={inp}
          />
        </div>
        {/* SAAT ARALIĞI — bitiş her zaman başlangıçtan büyük tutulur, yoksa
            sunucu 400 döner ve ekran sebepsiz boşalır. */}
        <div>
          <label className="block text-xs text-slate-500">Saat</label>
          <div className="flex items-center gap-1">
            <select
              value={bas}
              onChange={(e) => {
                const v = Number(e.target.value);
                setBas(v);
                if (v >= bit) setBit(Math.min(24, v + 1));
              }}
              className={inp}
              aria-label="Başlangıç saati"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
            <span className="text-slate-400">–</span>
            <select
              value={bit}
              onChange={(e) => {
                const v = Number(e.target.value);
                setBit(v);
                if (v <= bas) setBas(Math.max(0, v - 1));
              }}
              className={inp}
              aria-label="Bitiş saati"
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {h === 24 ? "24:00" : `${String(h).padStart(2, "0")}:00`}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(bas !== 0 || bit !== 24) && (
          <button
            onClick={() => {
              setBas(0);
              setBit(24);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Gün geneli
          </button>
        )}
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Yükleniyor…" : "Yenile"}
        </button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className="text-xl font-bold text-brand-dark">
                {data.summary.totalStopMin} dk
              </div>
              <div className="text-xs text-slate-500">Toplam duraklama</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className="text-xl font-bold text-slate-900">
                {data.summary.stopCount}
              </div>
              <div className="text-xs text-slate-500">Durak</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className="text-xl font-bold text-slate-900">
                {data.summary.pingCount}
              </div>
              <div className="text-xs text-slate-500">Konum kaydı</div>
            </div>
          </div>

          {/* 🔴 "BİLMİYORUM" AYRI BİR SAYI (2026-08-11).
              Öncesinde akışın sustuğu süre hiçbir yerde yazmıyordu; daha kötüsü
              boşluğun iki ucu aynı noktadaysa süre DURAK olarak yutuluyor ve
              "şoför 47 dk durakladı" diye okunuyordu. Ölçüldü: 10 Ağustos'ta tek
              şoförde 34, 38 ve 52 dakikalık üç boşluk vardı. Duraklama iddiası
              maaşa dokunur; ölçülmeden yazılmamalı. */}
          {(data.summary.delikSayisi ?? 0) > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">
                ⚠️ {data.summary.delikSayisi} kesinti ·{" "}
                {data.summary.bilinmeyenDk} dk BİLİNMİYOR
                {(data.summary.enUzunDelikDk ?? 0) > 0 &&
                  ` · en uzunu ${data.summary.enUzunDelikDk} dk`}
              </p>
              <p className="mt-1 leading-relaxed">
                Bu sürelerde şoförün telefonu konum göndermedi.{" "}
                {(data.summary.kopukSayisi ?? 0) > 0 ? (
                  <>
                    Bunların <strong>{data.summary.kopukSayisi} tanesinde</strong>{" "}
                    kesintinin iki ucu farklı yerde — o aralıkta nereye gittiği{" "}
                    <strong>bilinmiyor</strong>, harita orada çizgi çizmez.
                  </>
                ) : (
                  <>
                    Kesintilerin iki ucu aynı noktada: araç yerinden kıpırdamamış
                    görünüyor. Yine de bu süre <strong>ölçüm değil</strong> —
                    &quot;orada bekledi&quot; diye kesin konuşma.
                  </>
                )}
              </p>
            </div>
          )}

          {data.points.length > 0 ? (
            <>
              <div className={`${MAP_H} [&>div]:!h-full`}>
                <RouteMap
                  key={`${driverId}-${date}`}
                  points={data.points}
                  parcalar={data.parcalar}
                  stops={data.stops}
                  playing={playing}
                  onDone={stopPlaying}
                />
              </div>
              <div className="flex gap-2">
                {!playing ? (
                  <button
                    onClick={() => setPlaying(true)}
                    disabled={data.points.length < 2}
                    className="rounded-lg border border-brand px-4 py-2.5 text-sm font-medium text-brand-dark disabled:opacity-50"
                  >
                    ▶ Rotayı oynat
                  </button>
                ) : (
                  <button
                    onClick={() => setPlaying(false)}
                    className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600"
                  >
                    ■ Durdur
                  </button>
                )}
              </div>
            </>
          ) : data.summary.pingCount > 0 ? (
            /* 🔴 HAREKETSİZ GÜN (2026-08-08). Konum GELMİŞ ama çizilecek yol
               yok: şoför gün boyu dar bir kümede kalmış. Burası eskiden boş
               mesaja düşüyor ve "mesaiye çıkılmamış" diyordu — ekranın hemen
               üstünde "51 Konum kaydı" yazarken. Artık haritayı duraklarla
               gösteriyoruz: halıcı şoförün NEREDE durduğunu görebilmeli. */
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="font-medium text-amber-900">
                  Şoför gün boyu aynı bölgede kaldı
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-amber-800">
                  {data.summary.pingCount} konum kaydı var ama araç yer
                  değiştirmemiş, o yüzden çizilecek bir yol yok. Aşağıdaki
                  harita nerede beklediğini gösteriyor.
                </p>
              </div>
              {data.stops.length > 0 && (
                <div className={`${MAP_H} [&>div]:!h-full`}>
                  <RouteMap
                    key={`${driverId}-${date}-duruyor`}
                    points={data.stops.map(
                      (s) => [s.lat, s.lng] as [number, number],
                    )}
                    stops={data.stops}
                    playing={false}
                    onDone={stopPlaying}
                  />
                </div>
              )}
            </>
          ) : (
            (() => {
              const m = bosMesaji(data.tani, date, today);
              return (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="font-medium text-slate-700">{m.baslik}</p>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
                    {m.aciklama}
                  </p>
                </div>
              );
            })()
          )}

          {data.stops.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                Duraklar
              </div>
              {data.stops.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-slate-50 px-4 py-2 text-sm last:border-0"
                >
                  <span className="text-slate-600">
                    {new Date(s.startedAt).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {s.address ?? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`}
                  </span>
                  <span className="font-medium text-slate-800">
                    {s.durationMin} dk
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
