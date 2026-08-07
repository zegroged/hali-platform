"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// WHATSAPP CEVAP KUTUSU (2026-07-29).
//
// 24 SAAT KURALI (Meta): müşteri bize yazdıktan sonra 24 saat boyunca serbest
// metin gönderilebilir; pencere kapanınca yalnız onaylı şablon (sipariş
// bildirimleri) gider. Kutuyu kapalı pencereye rağmen açık bırakmak halıcıya
// "yazdım, gitti" hissi verirdi — Meta 131047 döndürür ve mesaj ULAŞMAZ.
// Bu yüzden pencere kapalıyken kutu KAPALI ve sebebi yazılı.
//
// Kalan süre sayfa açık kaldıkça eskimesin diye kapanış anı ISO olarak gelir ve
// dakikada bir yeniden hesaplanır. İlk render sunucudan gelen `kalanDk` ile
// yapılır — aksi hâlde hidrasyon uyuşmazlığı olurdu.

/** 372 → "6 sa 12 dk" */
function sureMetni(dk: number): string {
  const sa = Math.floor(dk / 60);
  const k = dk % 60;
  return sa > 0 ? `${sa} sa ${k} dk` : `${k} dk`;
}

export default function WhatsAppReply({
  phone,
  kalanDk,
  kapanisISO,
  /** Cevap ucu — halıcı paneli varsayılan, admin sahipsiz kutusu farklı
   *  (2026-08-03): kurallar farklı olduğu için uç de ayrıdır. */
  endpoint = "/api/panel/whatsapp/mesaj",
  yerTutucu,
}: {
  phone: string;
  kalanDk: number;
  kapanisISO: string | null;
  endpoint?: string;
  yerTutucu?: string;
}) {
  const router = useRouter();
  const [kalan, setKalan] = useState(kalanDk);
  const [metin, setMetin] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  // Başka bir sohbete geçilince sunucudan gelen yeni süreyi al.
  useEffect(() => {
    setKalan(kalanDk);
    setMetin("");
    setHata(null);
  }, [kalanDk, phone]);

  useEffect(() => {
    if (!kapanisISO) return;
    const hesapla = () =>
      setKalan(
        Math.max(
          0,
          Math.floor((new Date(kapanisISO).getTime() - Date.now()) / 60000),
        ),
      );
    const t = setInterval(hesapla, 30000);
    return () => clearInterval(t);
  }, [kapanisISO]);

  const acik = kalan > 0;

  async function gonder() {
    const govde = metin.trim();
    if (!govde || gonderiliyor) return;
    setHata(null);
    setGonderiliyor(true);
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, body: govde }),
      });
    } catch {
      setGonderiliyor(false);
      setHata("Bağlantı kurulamadı. İnterneti kontrol edip tekrar dene.");
      return;
    }
    setGonderiliyor(false);
    if (res.ok) {
      setMetin("");
      router.refresh(); // gönderilen mesaj listeye düşsün
      return;
    }
    // Sözleşme: hata gövdesi {error}. Okunamazsa genel metin.
    let mesaj = "Mesaj gönderilemedi.";
    try {
      const d = (await res.json()) as { error?: string };
      if (d?.error) mesaj = d.error;
    } catch {}
    setHata(mesaj);
  }

  return (
    <div className="space-y-2">
      {acik ? (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          Yanıt penceresi: <strong>{sureMetni(kalan)}</strong>
          <span className="block text-xs text-emerald-700">
            Bu süre içinde istediğini yazabilirsin. Müşteri tekrar yazarsa süre
            yeniden 24 saate döner.
          </span>
        </p>
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Yanıt penceresi kapalı</p>
          <p className="mt-1 leading-relaxed">
            Müşteri 24 saatten uzun süre önce yazdı; yeni mesaj ancak sipariş
            bildirimleriyle gönderilebilir.
          </p>
          {/* 2026-08-07 akşam: işletme sahibi "tek seferlik bir konuşma mı
              olabiliyor?" diye sordu. Kural tek seferlik DEĞİL — müşteri her
              yazdığında pencere yeniden 24 saate döner. Bunu burada açıkça
              söylüyoruz, yoksa kapalı kutu "bir daha yazamam" gibi okunuyor. */}
          <p className="mt-1 leading-relaxed">
            <strong>Tek seferlik değildir:</strong> müşteri sana her yazdığında
            pencere yeniden 24 saate döner ve bu ekran kendiliğinden açılır —
            sayfayı yenilemene gerek yok.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            WhatsApp kuralıdır, bizim kısıtımız değil. Acil bir durum varsa
            müşteriyi telefonla ara.
          </p>
        </div>
      )}

      <textarea
        value={metin}
        onChange={(e) => setMetin(e.target.value)}
        disabled={!acik || gonderiliyor}
        rows={3}
        maxLength={1000}
        placeholder={
          acik
            ? (yerTutucu ?? "Müşteriye yazacağın mesaj…")
            : "Yanıt penceresi kapalı — mesaj yazılamaz"
        }
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          {acik ? `${metin.trim().length}/1000` : ""}
        </span>
        <button
          type="button"
          onClick={gonder}
          disabled={!acik || gonderiliyor || metin.trim().length === 0}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {gonderiliyor ? "Gönderiliyor…" : "Gönder"}
        </button>
      </div>

      {hata && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          {hata}
        </p>
      )}
    </div>
  );
}
