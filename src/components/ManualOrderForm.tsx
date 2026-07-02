"use client";

import { useState } from "react";
import { IconWallet } from "@/components/icons";

type Driver = { id: string; name: string };

export function ManualOrderForm({ drivers }: { drivers: Driver[] }) {
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    pickupAddress: "",
    approxM2: "",
    note: "",
    paymentMethod: "CASH" as "CASH" | "CARD",
    driverId: "",
  });
  const [result, setResult] = useState<{ code: string; trackingUrl: string } | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (
      !form.customerName ||
      form.customerPhone.length < 10 ||
      form.pickupAddress.length < 3
    ) {
      setErr("Ad, telefon ve adres gerekli.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/panel/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        pickupAddress: form.pickupAddress,
        approxM2: form.approxM2 ? Number(form.approxM2) : undefined,
        note: form.note || undefined,
        paymentMethod: form.paymentMethod,
        driverId: form.driverId || undefined,
      }),
    });
    setLoading(false);
    if (res.ok) setResult(await res.json());
    else setErr("Kayıt oluşturulamadı.");
  }

  const inp =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

  if (result) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <p className="font-semibold text-green-700">✓ Kayıt oluşturuldu</p>
        <p className="mt-3 text-sm text-slate-600">Müşteri takip kodu:</p>
        <p className="mt-1 text-3xl font-bold tracking-widest text-slate-900">
          {result.code}
        </p>
        <div className="mt-4 rounded-lg bg-white p-3">
          <p className="text-xs text-slate-500">Takip linki</p>
          <a
            href={result.trackingUrl}
            className="break-all text-sm text-brand-dark underline"
          >
            {result.trackingUrl}
          </a>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          SMS müşteriye gönderildi. Bu kodu/linki müşterine verebilirsin —
          sistemi bilmeden son durumu izler.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(result.trackingUrl);
              setCopied(true);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            {copied ? "Kopyalandı ✓" : "Linki kopyala"}
          </button>
          <button
            onClick={() => {
              setResult(null);
              setCopied(false);
              setForm({
                customerName: "",
                customerPhone: "",
                pickupAddress: "",
                approxM2: "",
                note: "",
                paymentMethod: "CASH",
                driverId: "",
              });
            }}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Yeni kayıt
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className={inp}
        placeholder="Müşteri adı soyadı"
        value={form.customerName}
        onChange={(e) => set("customerName", e.target.value)}
      />
      <input
        className={inp}
        placeholder="Telefon (05xx...)"
        value={form.customerPhone}
        onChange={(e) => set("customerPhone", e.target.value)}
      />
      <textarea
        className={inp}
        placeholder="Adres"
        rows={2}
        value={form.pickupAddress}
        onChange={(e) => set("pickupAddress", e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className={inp}
          placeholder="Yaklaşık m² (ops.)"
          inputMode="decimal"
          value={form.approxM2}
          onChange={(e) => set("approxM2", e.target.value)}
        />
        {drivers.length > 0 && (
          <select
            className={inp}
            value={form.driverId}
            onChange={(e) => set("driverId", e.target.value)}
          >
            <option value="">Şoför (otomatik)</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <textarea
        className={inp}
        placeholder="Not (ops.)"
        rows={2}
        value={form.note}
        onChange={(e) => set("note", e.target.value)}
      />
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <IconWallet size={14} /> Tahsilat teslimde, kapıda nakit.
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        disabled={loading}
        className="w-full rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {loading ? "Oluşturuluyor…" : "Kayıt Oluştur & Takip Kodu Üret"}
      </button>
    </form>
  );
}
