"use client";

import { useCallback, useState } from "react";
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
type RouteData = {
  points: [number, number][];
  stops: Stop[];
  summary: { pingCount: number; stopCount: number; totalStopMin: number };
};

export function RouteHistory({
  drivers,
  today,
}: {
  drivers: Driver[];
  today: string;
}) {
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [data, setData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const stopPlaying = useCallback(() => setPlaying(false), []);

  async function load() {
    if (!driverId) return;
    setLoading(true);
    setPlaying(false);
    const res = await fetch(
      `/api/panel/drivers/route?driverId=${driverId}&date=${date}`,
    );
    setLoading(false);
    setData(res.ok ? await res.json() : null);
  }

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
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Yükleniyor…" : "Göster"}
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

          {data.points.length > 0 ? (
            <>
              <div className={`${MAP_H} [&>div]:!h-full`}>
                <RouteMap
                  key={`${driverId}-${date}`}
                  points={data.points}
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
                    className="rounded-lg border border-brand px-4 py-1.5 text-sm font-medium text-brand-dark disabled:opacity-50"
                  >
                    ▶ Rotayı oynat
                  </button>
                ) : (
                  <button
                    onClick={() => setPlaying(false)}
                    className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600"
                  >
                    ■ Durdur
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
              Bu gün için konum kaydı yok.
            </div>
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
