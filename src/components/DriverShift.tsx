"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haversineKm } from "@/lib/geo";

export function DriverShift({ initialOnShift }: { initialOnShift: boolean }) {
  const [on, setOn] = useState(initialOnShift);
  const [sent, setSent] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const wakeRef = useRef<{ release?: () => void } | null>(null);
  const lastPost = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const router = useRouter();

  async function toggle() {
    const next = !on;
    const res = await fetch("/api/driver/shift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on: next }),
    });
    if (res.ok) {
      setOn(next);
      router.refresh();
    }
  }

  useEffect(() => {
    function stop() {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      if (wakeRef.current) {
        wakeRef.current.release?.();
        wakeRef.current = null;
      }
      lastPost.current = null;
    }

    if (!on) {
      stop();
      return;
    }

    setErr(null);
    if ("geolocation" in navigator) {
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const now = Date.now();
          const last = lastPost.current;
          const movedM = last
            ? haversineKm(last.lat, last.lng, latitude, longitude) * 1000
            : Infinity;
          const dt = last ? now - last.t : Infinity;
          // Yükü azalt: 25 m'den az hareket VE 8 sn'den yeni ise gönderme
          if (movedM < 25 && dt < 8000) return;
          lastPost.current = { lat: latitude, lng: longitude, t: now };
          fetch("/api/driver/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          }).then(() => setSent((n) => n + 1));
        },
        () => setErr("Konum alınamıyor — izin verildiğinden emin olun."),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
      );
    }

    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release?: () => void }> };
    };
    nav.wakeLock
      ?.request("screen")
      .then((w) => {
        wakeRef.current = w;
      })
      .catch(() => {});

    return stop;
  }, [on]);

  return (
    <div
      className={`rounded-xl p-4 ${
        on ? "bg-green-50 border border-green-200" : "bg-white border border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-900">
            {on ? "Mesaidesin 🟢" : "Mesai dışısın"}
          </p>
          <p className="text-xs text-slate-500">
            {on
              ? `Konum paylaşılıyor (${sent} güncelleme). Uygulamayı açık tut.`
              : "Mesaiyi başlat, halıcı seni canlı görsün."}
          </p>
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </div>
        <button
          onClick={toggle}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
            on ? "bg-red-500 hover:bg-red-600" : "bg-brand hover:bg-brand-dark"
          }`}
        >
          {on ? "Mesaiyi Bitir" : "Mesaiye Başla"}
        </button>
      </div>
    </div>
  );
}
