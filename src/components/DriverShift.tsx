"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haversineKm } from "@/lib/geo";

// 🔴 DEMİRLEME (2026-08-07 akşam) — İKİZ: `driver-app/src/tracking.ts`.
// Gerekçe ve iki durumlu makinenin tam açıklaması orada; birini değiştiren
// ötekini de değiştirmeli (DEVIR §7 "İKİZ mantıklar"). Özet: duruyorken
// gönderilen konum FIX DEĞİL ÇIPADIR; çıpa ancak cihazın kendi hız ölçümü
// ≥1,5 m/sn olunca ya da üst üste iki fix 60 m'yi aşınca bırakılır.
const DEMIR_ESIK_M = 60;
const HIZ_ESIK_MS = 1.5;
const ONAY_ARDISIK = 2;
const DURMA_SURESI_MS = 90_000;

export function DriverShift({ initialOnShift }: { initialOnShift: boolean }) {
  const [on, setOn] = useState(initialOnShift);
  const [sent, setSent] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  // İzin diyaloğu cevapsız kalırsa hiçbir geolocation callback'i tetiklenmez —
  // 20 sn boyunca tek konum gelmediyse proaktif uyarı göster.
  const [noFix, setNoFix] = useState(false);
  // Son fix kaba ise (GPS oturmadı) ± metre değeri — gönderilmez, uyarı gösterilir.
  const [lowAcc, setLowAcc] = useState<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const wakeRef = useRef<{ release?: () => void } | null>(null);
  const lastPost = useRef<{ lat: number; lng: number; t: number } | null>(null);
  // Demirleme durumu (yukarıdaki blok).
  const durum = useRef<"DURUYOR" | "HAREKETTE">("DURUYOR");
  const demir = useRef<{ lat: number; lng: number } | null>(null);
  const uzakArdisik = useRef(0);
  const sonHareketAt = useRef(0);
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
      // Mesai kapanınca demirleme sıfırlanır — yeni mesai dünkü çıpayla
      // başlamasın (İKİZ: tracking.ts startTracking).
      durum.current = "DURUYOR";
      demir.current = null;
      uzakArdisik.current = 0;
    }

    if (!on) {
      stop();
      return;
    }

    setErr(null);
    if ("geolocation" in navigator) {
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed } = pos.coords;
          // KAYMA SÜZGECİ: GPS oturmadan gelen kaba fix (Wi-Fi/baz, yüzlerce
          // metre sapar) HİÇ gönderilmez — haritada "gitmediği yere gitmiş"
          // izlerinin köküydü. GPS oturunca (≤150 m) gönderim başlar.
          if (accuracy != null && accuracy > 150) {
            setLowAcc(Math.round(accuracy));
            return;
          }
          setLowAcc(null);
          const now = Date.now();

          // DEMİRLEME — duruyorsak fix'i değil çıpayı bildir.
          let gLat = latitude;
          let gLng = longitude;
          if (durum.current === "DURUYOR") {
            if (!demir.current) demir.current = { lat: latitude, lng: longitude };
            const uzaklik =
              haversineKm(
                demir.current.lat,
                demir.current.lng,
                latitude,
                longitude,
              ) * 1000;
            uzakArdisik.current =
              uzaklik > DEMIR_ESIK_M ? uzakArdisik.current + 1 : 0;
            const hizVar = speed != null && speed >= HIZ_ESIK_MS;
            if (hizVar || uzakArdisik.current >= ONAY_ARDISIK) {
              durum.current = "HAREKETTE";
              uzakArdisik.current = 0;
              demir.current = null;
              sonHareketAt.current = now;
            } else {
              gLat = demir.current.lat;
              gLng = demir.current.lng;
            }
          }
          if (durum.current === "HAREKETTE") {
            const l = lastPost.current;
            if (
              !l ||
              haversineKm(l.lat, l.lng, latitude, longitude) * 1000 >= 25
            ) {
              sonHareketAt.current = now;
            } else if (now - sonHareketAt.current > DURMA_SURESI_MS) {
              durum.current = "DURUYOR";
              uzakArdisik.current = 0;
              demir.current = { lat: latitude, lng: longitude };
              gLat = latitude;
              gLng = longitude;
            }
          }

          const last = lastPost.current;
          const movedM = last
            ? haversineKm(last.lat, last.lng, gLat, gLng) * 1000
            : Infinity;
          const dt = last ? now - last.t : Infinity;
          // Yükü azalt: 25 m'den az hareket VE 8 sn'den yeni ise gönderme
          if (movedM < 25 && dt < 8000) return;
          lastPost.current = { lat: gLat, lng: gLng, t: now };
          fetch("/api/driver/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: gLat, lng: gLng, acc: accuracy }),
          })
            .then(() => setSent((n) => n + 1))
            .catch(() => {
              // Mobil veride baz geçişi anlık koparabilir — kalp atışını
              // beklemeden bir SONRAKİ fix'te hemen yeniden denesin.
              if (lastPost.current) lastPost.current.t = 0;
            });
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

  // Kalp atışı: duran şoförde watchPosition yeni konum üretmez (+25m/8sn
  // süzgeci de keser) → 5 dk sonra panel onu "çevrimdışı" gösteriyordu.
  // Hareket olmasa da dakikada bir son bilinen konumu yeniden gönder —
  // "hâlâ buradayım" der, durak tespitini de besler.
  useEffect(() => {
    if (!on) return;
    const hb = setInterval(() => {
      const last = lastPost.current;
      if (!last || Date.now() - last.t < 55_000) return;
      last.t = Date.now();
      fetch("/api/driver/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: last.lat, lng: last.lng }),
      })
        .then(() => setSent((n) => n + 1))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(hb);
  }, [on]);

  useEffect(() => {
    if (!on || sent > 0) {
      setNoFix(false);
      return;
    }
    const t = setTimeout(() => setNoFix(true), 20_000);
    return () => clearTimeout(t);
  }, [on, sent]);

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
          {!err && noFix && sent === 0 && lowAcc == null && (
            <p className="mt-1 text-xs text-amber-700">
              Henüz konum alınamadı. Tarayıcının konum iznini ve cihazın konum
              servisini (Windows/telefon ayarları) kontrol et; sayfa açık ve
              önde kalmalı.
            </p>
          )}
          {!err && lowAcc != null && (
            <p className="mt-1 text-xs text-amber-700">
              Konum hassasiyeti düşük (±{lowAcc} m) — yanlış yer görünmesin
              diye gönderilmiyor. Açık alanda GPS oturunca otomatik başlar.
            </p>
          )}
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

      {/* KVKK Aydınlatma Tebliği md.5/1-a: konum işlemeye dair KALICI katmanlı
          aydınlatma — konum paylaşımı başlamadan önce de görünür (KVKK
          md.5/2-f meşru menfaat dengesini güçlendirir). İlk gösterim anı
          sunucuda Driver.privacyNoticeAt'e kaydedilir (Tebliğ md.6). */}
      <p className="mt-3 border-t border-slate-900/10 pt-2.5 text-sm text-slate-500">
        {/* EKSİK AYDINLATMA DÜZELTİLDİ (2026-07-29 denetimi): burada yalnız
            "müşteri görür" yazıyordu, oysa hesabını açan İŞLETME de canlı
            konumu, geçmiş gün rotasını ve aylık durak raporunu görüyor.
            Şoförün gerçekte kimin gördüğünü bilmesi KVKK md.10'un konusu. */}
        Mesai açıkken konumun, teslimat takibi, operasyon yönetimi ve güvenlik
        amacıyla işlenir. Teslimatını bekleyen müşteri canlı konumunu görür;{" "}
        <strong>çalıştığın işletme</strong> ise mesai boyunca canlı konumunu,
        geçmiş günlerin rota kaydını ve aylık durak özetini görebilir. Mesai
        kapalıyken konum işlenmez. Ayrıntı:{" "}
        <a
          href="/kvkk"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-brand-dark underline"
        >
          KVKK Aydınlatma Metni
        </a>
        . Mesaiyi kapattığında izleme durur.
      </p>
    </div>
  );
}
