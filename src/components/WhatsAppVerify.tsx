"use client";

// İŞLETMENİN WHATSAPP NUMARASINI DOĞRULA (arayüz — 2026-08-06).
//
// Arka uç uçları (`/api/panel/whatsapp/request` + `/confirm`) 26 Temmuz'da
// yazılıp canlıya çıkmıştı ama ARAYÜZÜ HİÇ BAĞLANMAMIŞTI: özellik kodda vardı,
// kullanıcı için yoktu. Bu bileşen o boşluğu kapatıyor.
//
// ⚠️ Kod WhatsApp'ın AUTHENTICATION şablonuyla (`dogrulama_kodu`) gider ve o
// şablon Meta'da HENÜZ YOK — işletme doğrulaması bitmeden alınamıyor. Yani
// bugün "Kod gönderilemedi" hatası beklenen davranıştır. Bu yüzden sunucunun
// GERÇEK hata metni gösteriliyor (eskiden yutuluyordu): kullanıcı "bozuk" mu
// "henüz açılmadı" mı olduğunu ayırt edebilsin.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WhatsAppVerify({
  phone,
  verified,
}: {
  phone: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [asama, setAsama] = useState<"idle" | "sent">("idle");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function cagir(url: string, body: unknown): Promise<boolean> {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        // Sunucunun kendi metni: "numara kayıtlı değil", "kod hatalı",
        // "doğrulama şu an kapalı" gibi ayrımlar kullanıcıya lazım.
        setErr(d?.error ?? "İşlem tamamlanamadı.");
        return false;
      }
      return true;
    } catch {
      setErr("Bağlantı hatası, lütfen tekrar deneyin.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  if (verified) {
    return (
      <p className="text-sm font-medium text-green-700">
        ✓ WhatsApp numarası doğrulandı ({phone})
      </p>
    );
  }

  if (asama === "idle") {
    return (
      <div>
        <button
          type="button"
          onClick={async () => {
            if (await cagir("/api/panel/whatsapp/request", { phone }))
              setAsama("sent");
          }}
          disabled={loading}
          className="rounded-lg border border-brand px-3 py-2.5 text-sm font-medium text-brand-dark disabled:opacity-60"
        >
          {loading ? "Gönderiliyor…" : `📱 ${phone} numaramı doğrula`}
        </button>
        <p className="mt-1 text-xs text-slate-500">
          Bu numaraya WhatsApp&apos;tan 6 haneli kod gönderilir. Doğrulanmış
          numara müşteri sayfanda &quot;doğrulanmış WhatsApp&quot; olarak görünür.
        </p>
        {err && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {err}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="6 haneli kod"
          inputMode="numeric"
          maxLength={6}
          aria-label="WhatsApp doğrulama kodu"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={async () => {
            if (await cagir("/api/panel/whatsapp/confirm", { phone, code }))
              router.refresh();
          }}
          disabled={loading || code.length !== 6}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Onayla
        </button>
        <button
          type="button"
          onClick={() => cagir("/api/panel/whatsapp/request", { phone })}
          disabled={loading}
          className="text-sm text-slate-500 underline"
        >
          Tekrar gönder
        </button>
      </div>
      {err && (
        <p role="alert" className="text-sm text-red-600">
          {err}
        </p>
      )}
    </div>
  );
}
