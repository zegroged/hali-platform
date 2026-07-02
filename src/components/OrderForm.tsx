"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconMapPin, IconWallet, IconCheck } from "@/components/icons";

export function OrderForm({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    pickupAddress: "",
    approxM2: "",
    note: "",
    paymentMethod: "CASH" as "CASH" | "CARD",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function captureLocation() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition((pos) =>
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (
      !form.customerName ||
      form.customerPhone.length < 10 ||
      form.pickupAddress.length < 5
    ) {
      setError("Lütfen ad, telefon ve adresi doğru doldurun.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        pickupAddress: form.pickupAddress,
        pickupLat: coords?.lat,
        pickupLng: coords?.lng,
        approxM2: form.approxM2 ? Number(form.approxM2) : undefined,
        note: form.note || undefined,
        paymentMethod: form.paymentMethod,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Sipariş oluşturulamadı. Bilgileri kontrol edin.");
      return;
    }
    const data = await res.json();
    router.push(`/takip/${data.trackingToken}`);
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <p className="text-sm text-slate-500">
        <span className="font-medium text-slate-700">{businessName}</span>{" "}
        halıcısına talep oluşturuyorsun.
      </p>

      <input
        className={input}
        placeholder="Ad Soyad"
        value={form.customerName}
        onChange={(e) => set("customerName", e.target.value)}
      />
      <input
        className={input}
        placeholder="Telefon (05xx...)"
        value={form.customerPhone}
        onChange={(e) => set("customerPhone", e.target.value)}
      />
      <textarea
        className={input}
        placeholder="Halının alınacağı adres"
        rows={2}
        value={form.pickupAddress}
        onChange={(e) => set("pickupAddress", e.target.value)}
      />
      <button
        type="button"
        onClick={captureLocation}
        className="inline-flex items-center gap-1 text-sm text-brand-dark hover:underline"
      >
        <IconMapPin size={15} />
        {coords ? "Konum eklendi" : "Konumumu ekle (opsiyonel)"}
        {coords && <IconCheck size={14} />}
      </button>
      <input
        className={input}
        placeholder="Yaklaşık m² (opsiyonel)"
        inputMode="decimal"
        value={form.approxM2}
        onChange={(e) => set("approxM2", e.target.value)}
      />
      <textarea
        className={input}
        placeholder="Ek not (opsiyonel)"
        rows={2}
        value={form.note}
        onChange={(e) => set("note", e.target.value)}
      />

      <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <IconWallet size={16} />
        <span>
          Ödeme <span className="font-medium">teslimde, kapıda nakit</span> alınır.
        </span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        disabled={loading}
        className="w-full rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {loading ? "Gönderiliyor…" : "Talebi Oluştur"}
      </button>
    </form>
  );
}
