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

/** Gönderim freni. 🔴 2026-08-08'e kadar burada 8_000 vardı, mobil ikizinde
 *  60_000 — yani "İKİZ" yorumu YANLIŞTI ve web 7 kat fazla istek atıyordu
 *  (8 saatlik mesai ≈ 3.400 POST, mobil ≈ 480). Duruyorken koordinat çıpaya
 *  sabit olduğu için tek valf süredir; 60 sn'lik kalp atışı zaten "buradayım"
 *  demeye yetiyor. */
const GONDERIM_FRENI_MS = 60_000;

/** Mesai açılmadan ÖNCE konum KANITI iste (2026-08-08, kullanıcı isteği:
 *  "konum açık değilse mesaiye başlayamasın").
 *
 *  Mobilde bu kapı 08-08'de kapatıldı ama web'e uğranmamıştı. Kozmetik bir
 *  eksik değil: otomatik atama mesaideki şoförü öncelediği için
 *  (`api/orders/route.ts`) konum GÖNDERMEYEN şoför, gönderene tercih
 *  ediliyordu. */
function konumKaniti(): Promise<{ ok: true } | { ok: false; sebep: string }> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({
        ok: false,
        sebep:
          "Bu tarayıcı konum paylaşımını desteklemiyor. Şoför uygulamasını kullan.",
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve({ ok: true }),
      (e) =>
        resolve({
          ok: false,
          sebep:
            e.code === e.PERMISSION_DENIED
              ? "Konum izni verilmedi. Mesai açılmadı — izin vermeden halıcın seni haritada göremez (adres çubuğundaki kilit simgesinden izin verebilirsin)."
              : "Konum alınamadı. Cihazın konum servisi kapalı olabilir; açıp tekrar dene.",
        }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}

export function DriverShift({ initialOnShift }: { initialOnShift: boolean }) {
  const [on, setOn] = useState(initialOnShift);
  const [sent, setSent] = useState(0);
  /** Artınca konum izleyicisi sökülüp yeniden kurulur (akış toparlama). */
  const [kurulum, setKurulum] = useState(0);
  /** Akışın başladığı an — "henüz ilk fix gelmedi" ile "akış öldü" AYRI şeyler.
   *  Doğrulama denetimi yakaladı: yalnız `sonGonderim`e bakınca mesai açılışında
   *  ref 0 olduğu için yaş Infinity çıkıyor ve 30 saniyede bir kendini yeniden
   *  kuruyordu. Sunucu bekçisi de aynı deseni kullanıyor:
   *  `Math.max(lastSeenAt, shiftStartedAt)` (lib/konumBekcisi.ts). */
  const akisBaslangic = useRef(0);
  /** Üst üste kaç kez toparlandı — sonsuz döngüye tavan. */
  const toparlamaSayaci = useRef(0);
  const [err, setErr] = useState<string | null>(null);
  // İzin diyaloğu cevapsız kalırsa hiçbir geolocation callback'i tetiklenmez —
  // 20 sn boyunca tek konum gelmediyse proaktif uyarı göster.
  const [noFix, setNoFix] = useState(false);
  // Son fix kaba ise (GPS oturmadı) ± metre değeri — gönderilmez, uyarı gösterilir.
  const [lowAcc, setLowAcc] = useState<number | null>(null);
  // Mesai açılırken konum kanıtı bekleniyor mu (düğme "Kontrol ediliyor…").
  const [kontrol, setKontrol] = useState(false);
  // 🔴 SON BAŞARILI GÖNDERİM (2026-08-08). Eskiden yalnız `sent` sayacı vardı
  // ve `res.ok` OKUNMADAN artıyordu: 401/429/500'de bile artıyor, `sent>0`
  // olunca tek uyarı kalıcı susuyordu. Şoför "137 güncelleme" okurken
  // veritabanına tek ping girmemiş olabiliyordu. (DENETİM md.8c)
  const sonGonderim = useRef(0);
  const [yasSn, setYasSn] = useState<number | null>(null);
  const [gonderimHatasi, setGonderimHatasi] = useState<string | null>(null);
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
    setErr(null);
    // MESAİ KONUMA BAĞLI (2026-08-08). Konum kanıtı gelmeden mesai AÇILMAZ.
    // Kapatma bu kapıya takılmamalı — konumu bozuk şoför mesaisini
    // kapatabilmeli.
    if (next) {
      setKontrol(true);
      const k = await konumKaniti();
      setKontrol(false);
      if (!k.ok) {
        setErr(k.sebep);
        return;
      }
    }
    try {
      const res = await fetch("/api/driver/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: next }),
      });
      // 🔴 else dalı YOKTU: 401/ağ kopmasında düğme hiç tepki vermiyordu ve
      // şoför "Mesaiyi Bitir"e basıp kapandığını sanıyordu (2026-08-08).
      if (!res.ok) {
        setErr(
          res.status === 401
            ? "Oturumun düşmüş — sayfayı yenileyip tekrar giriş yap."
            : `Mesai durumu değişmedi (sunucu ${res.status}). Tekrar dene.`,
        );
        return;
      }
      setOn(next);
      setSent(0);
      sonGonderim.current = 0;
      akisBaslangic.current = next ? Date.now() : 0;
      toparlamaSayaci.current = 0;
      setYasSn(null);
      router.refresh();
    } catch {
      setErr("Bağlantı yok — mesai durumu değişmedi. Tekrar dene.");
    }
  }

  /** Gönderimin GERÇEKTEN olduğunu yanıttan doğrula (İKİZ: driver-app
   *  `src/api.ts` — o taraf bu ayrımı 2026-08-07'den beri yapıyordu). */
  function gonderimSonucu(r: Response) {
    if (r.ok) {
      sonGonderim.current = Date.now();
      toparlamaSayaci.current = 0; // akış düzeldi, tavan sıfırlansın
      setSent((n) => n + 1);
      setGonderimHatasi(null);
      return;
    }
    // Başarısız: freni sıfırla ki bir sonraki fix hemen denesin.
    if (lastPost.current) lastPost.current.t = 0;
    // 🔴 401'DE AKIŞI DURDUR (2026-08-11). Eskiden yalnız METİN basılıyordu:
    // oturum ölse bile watchPosition ve kalp atışı çalışmaya devam ediyor,
    // düğme hâlâ "Mesaiyi Bitir" gösteriyordu. Üstelik yukarıdaki fren
    // sıfırlaması 401'de de çalıştığı için her fix HEMEN yeniden 401 yiyordu
    // — saatlerce boşa GPS, pil ve veri. `setOn(false)` aşağıdaki efektin
    // temizliğini tetikler: watch ve wake lock bırakılır.
    if (r.status === 401) setOn(false);
    setGonderimHatasi(
      r.status === 401
        ? "Oturumun düşmüş — konum durdu. Sayfayı yenileyip tekrar giriş yap, sonra mesaiyi yeniden aç."
        : r.status === 429
          ? "Çok sık gönderim — sunucu kısıtladı, birazdan kendiliğinden düzelir."
          : `Konum sunucuya yazılamadı (${r.status}).`,
    );
  }

  // Son başarılı gönderimin yaşı — ekran "yeşil ama ölü" kalmasın.
  useEffect(() => {
    if (!on) {
      setYasSn(null);
      return;
    }
    const hesapla = () =>
      setYasSn(
        sonGonderim.current === 0
          ? -1
          : Math.round((Date.now() - sonGonderim.current) / 1000),
      );
    hesapla();
    const id = setInterval(hesapla, 15_000);
    return () => clearInterval(id);
  }, [on]);

  // 🔴 AKIŞ ÖLÜNCE KENDİNİ TOPARLA (2026-08-11).
  //
  // Ekran ölümü ZATEN BİLİYORDU (`akisOlu` kartı sarıya boyuyordu) ama bu
  // bilgiyle hiçbir şey yapmıyordu: KURAL 1'in yarısı (görünürlük) vardı,
  // yarısı (kurtarma) yoktu. Sekme arka plana düşüp geri geldiğinde ya da
  // GPS kesintisinde watch sessizce ölü kalıyor, tek çıkış mesaiyi elle
  // kapatıp açmaktı.
  //
  // Mobil ikizi bunu 1.2.8'de kazandı (driver-app/src/notify.ts konumuDirilt):
  // 180 sn'dir veri gitmiyorsa görev SÖKÜLÜP yeniden kuruluyor. Burada da
  // aynı eşik ve aynı yöntem — `kurulum` artınca aşağıdaki efekt temizlenip
  // yeniden çalışır, yani watch bırakılıp yeniden kurulur.
  //
  // İzin zaten verilmiş olduğu için kullanıcıya yeni bir diyalog çıkmaz.
  useEffect(() => {
    if (!on) return;
    // Sayfa yenilenerek mesai açık geldiyse damga burada kurulur.
    if (akisBaslangic.current === 0) akisBaslangic.current = Date.now();
    const id = setInterval(() => {
      // REFERANS = son gönderim YA DA akış başlangıcı (hangisi yeniyse).
      // "Henüz ilk fix gelmedi" ölü DEĞİLDİR: bina içinde GPS kilidi
      // dakikalar sürebilir ve her turda watch'ı sökmek kilidi sıfırlar —
      // yani sözde toparlama, asıl sorunu KÖTÜLEŞTİRİR.
      const referans = Math.max(sonGonderim.current, akisBaslangic.current);
      if (referans === 0) return;
      if ((Date.now() - referans) / 1000 <= 180) return;

      // TAVAN: üç denemeden sonra durdur. Sonsuz sök/kur, wake lock ve GPS'i
      // boşuna yakar; bu noktada sorun sayfanın çözebileceği bir şey değil.
      if (toparlamaSayaci.current >= 3) {
        setGonderimHatasi(
          "Konum akışı düzelmiyor — mesaiyi kapatıp yeniden aç, olmazsa şoför uygulamasını kullan.",
        );
        return;
      }
      toparlamaSayaci.current += 1;
      // Yeni pencere aç: yoksa referans hep eski kalır ve her turda tetiklenir.
      akisBaslangic.current = Date.now();
      setGonderimHatasi(
        `Konum akışı durmuştu, yeniden başlatıldı (${toparlamaSayaci.current}/3).`,
      );
      setKurulum((k) => k + 1);
    }, 30_000);
    return () => clearInterval(id);
  }, [on]);

  useEffect(() => {
    // 🔴 İKİYE AYRILDI (2026-08-11, doğrulama denetimi bulgusu).
    //
    // Tek bir `stop()` vardı ve `lastPost`i null'lıyordu. Akış toparlaması
    // (watch'ı söküp yeniden kurma) da onu çağırdığı için kalp atışı
    // (`if (!last) return`) KALICI SUSUYORDU: yani "bayat konum" hâlini
    // "hiç konum yok" hâline çeviriyordu — düzeltmenin kendisi zarar veriyordu.
    //
    // Artık: yeniden kurulumda YALNIZ izleyici bırakılır; çıpa, son gönderim
    // ve demirleme durumu KORUNUR. Tam sıfırlama yalnız mesai kapanınca.
    function izleyiciyiBirak() {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      if (wakeRef.current) {
        wakeRef.current.release?.();
        wakeRef.current = null;
      }
    }

    function tamDur() {
      izleyiciyiBirak();
      lastPost.current = null;
      // Mesai kapanınca demirleme sıfırlanır — yeni mesai dünkü çıpayla
      // başlamasın (İKİZ: tracking.ts startTracking).
      durum.current = "DURUYOR";
      demir.current = null;
      uzakArdisik.current = 0;
      akisBaslangic.current = 0;
      toparlamaSayaci.current = 0;
    }

    if (!on) {
      tamDur();
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
          // Yükü azalt: 25 m'den az hareket VE frenden yeni ise gönderme
          if (movedM < 25 && dt < GONDERIM_FRENI_MS) return;
          lastPost.current = { lat: gLat, lng: gLng, t: now };
          fetch("/api/driver/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: gLat, lng: gLng, acc: accuracy }),
          })
            .then((r) => gonderimSonucu(r))
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

    // Temizlik YALNIZ izleyiciyi bırakır. `kurulum` artınca efekt yeniden
    // çalışır ve watch yeniden kurulur; çıpa/son gönderim korunduğu için
    // kalp atışı susmaz.
    return izleyiciyiBirak;
    // `kurulum` BİLEREK bağımlılıkta: artırıldığında efekt temizlenip yeniden
    // çalışır = watch sökülüp yeniden kurulur (yukarıdaki toparlama).
  }, [on, kurulum]);

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
        .then((r) => gonderimSonucu(r))
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

  // 🔴 AKIŞ ÖLÜYKEN YEŞİL GÖSTERME (2026-08-08). Başlık eskiden yalnız `on`a
  // bakıyordu: izin reddedilmiş olsa bile üstte yeşil "Mesaidesin", altında
  // kırmızı "Konum alınamıyor" AYNI ANDA duruyordu. Artık kart, mesai
  // durumuna değil AKIŞIN CANLILIĞINA göre renkleniyor.
  const akisOlu = on && (yasSn == null || yasSn < 0 || yasSn > 180);
  return (
    <div
      className={`rounded-xl p-4 ${
        !on
          ? "bg-white border border-slate-200"
          : akisOlu
            ? "bg-amber-50 border border-amber-300"
            : "bg-green-50 border border-green-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-900">
            {!on ? "Mesai dışısın" : akisOlu ? "Mesaidesin ⚠️" : "Mesaidesin 🟢"}
          </p>
          <p className="text-xs text-slate-500">
            {!on
              ? "Mesaiyi başlat, halıcı seni canlı görsün."
              : yasSn == null || yasSn < 0
                ? "Konum bekleniyor — sayfa açık ve önde kalmalı."
                : yasSn > 180
                  ? `⚠️ ${Math.round(yasSn / 60)} dk'dır konum gitmiyor — sayfa arka plana düşmüş olabilir.`
                  : `Konum gidiyor · son gönderim ${yasSn} sn önce (${sent} güncelleme).`}
          </p>
          {/* Tarayıcının doğal sınırı ARTIK YAZILI: sekme arka plana düşünce
              JS askıya alınır ve konum susar. Şoför bunu bilmeden telefonu
              cebine koyuyordu (mobilde ön plan servisi var, webde yok). */}
          {on && (
            <p className="mt-1 text-xs text-slate-500">
              Bu sayfa kapanır ya da arka plana düşerse konum paylaşımı durur.
              Kesintisiz takip için şoför uygulamasını kullan.
            </p>
          )}
          {gonderimHatasi && (
            <p className="mt-1 text-xs text-red-600">{gonderimHatasi}</p>
          )}
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
          disabled={kontrol}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
            on ? "bg-red-500 hover:bg-red-600" : "bg-brand hover:bg-brand-dark"
          }`}
        >
          {kontrol
            ? "Konum kontrol ediliyor…"
            : on
              ? "Mesaiyi Bitir"
              : "Mesaiye Başla"}
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
