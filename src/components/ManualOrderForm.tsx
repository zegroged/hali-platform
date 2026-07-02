"use client";

import { useState } from "react";
import { IconWallet } from "@/components/icons";

type Driver = { id: string; name: string };

/** Alan bazlı doğrulama hataları (alan adı → mesaj). */
type FieldErrors = Partial<
  Record<"customerName" | "customerPhone" | "pickupAddress" | "approxM2", string>
>;

/** m² metnini sayıya çevirir; Türkçe virgüllü ondalık da kabul eder. */
function parseM2(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    // Alan bazlı doğrulama — hatalı alan işaretlenir, mesajı altında gösterilir.
    const errs: FieldErrors = {};
    if (!form.customerName.trim()) errs.customerName = "Müşteri adı gerekli.";
    if (form.customerPhone.length < 10)
      errs.customerPhone = "Telefon 05xx ile başlamalı ve 11 hane olmalı.";
    if (form.pickupAddress.trim().length < 3)
      errs.pickupAddress = "Adres gerekli.";
    if (form.approxM2 && parseM2(form.approxM2) === null)
      errs.approxM2 = "Geçerli bir m² değeri gir (ör. 12,5).";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setErr("Lütfen işaretli alanları düzelt.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/panel/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          pickupAddress: form.pickupAddress,
          approxM2: form.approxM2
            ? (parseM2(form.approxM2) ?? undefined)
            : undefined,
          note: form.note || undefined,
          paymentMethod: form.paymentMethod,
          driverId: form.driverId || undefined,
        }),
      });
      if (res.ok) setResult(await res.json());
      else setErr("Kayıt oluşturulamadı.");
    } catch {
      setErr("Bağlantı hatası, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  const inpBase = "w-full rounded-lg border px-3 py-2 text-sm focus:border-brand";
  const inpCls = (bad?: string) =>
    `${inpBase} ${bad ? "border-red-500" : "border-slate-300"}`;
  const labelCls = "mb-1 block text-sm font-medium text-slate-700";
  const fieldErrCls = "mt-1 text-xs text-red-600";
  const optionalBadge = (
    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      opsiyonel
    </span>
  );

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
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {copied ? "Kopyalandı ✓" : "Linki kopyala"}
          </button>
          <button
            onClick={() => {
              setResult(null);
              setCopied(false);
              setFieldErrors({});
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
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Yeni kayıt
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div>
        <label htmlFor="manuel-ad" className={labelCls}>
          Müşteri adı soyadı
        </label>
        <input
          id="manuel-ad"
          className={inpCls(fieldErrors.customerName)}
          autoComplete="name"
          value={form.customerName}
          onChange={(e) => set("customerName", e.target.value)}
        />
        {fieldErrors.customerName && (
          <p className={fieldErrCls}>{fieldErrors.customerName}</p>
        )}
      </div>
      <div>
        <label htmlFor="manuel-telefon" className={labelCls}>
          Telefon
        </label>
        <input
          id="manuel-telefon"
          className={inpCls(fieldErrors.customerPhone)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={11}
          placeholder="05xxxxxxxxx"
          value={form.customerPhone}
          onChange={(e) =>
            set("customerPhone", e.target.value.replace(/\D/g, ""))
          }
        />
        {fieldErrors.customerPhone && (
          <p className={fieldErrCls}>{fieldErrors.customerPhone}</p>
        )}
      </div>
      <div>
        <label htmlFor="manuel-adres" className={labelCls}>
          Adres
        </label>
        <textarea
          id="manuel-adres"
          className={inpCls(fieldErrors.pickupAddress)}
          autoComplete="street-address"
          rows={2}
          value={form.pickupAddress}
          onChange={(e) => set("pickupAddress", e.target.value)}
        />
        {fieldErrors.pickupAddress && (
          <p className={fieldErrCls}>{fieldErrors.pickupAddress}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="manuel-m2" className={labelCls}>
            Yaklaşık m²
            {optionalBadge}
          </label>
          <div className="relative">
            <input
              id="manuel-m2"
              className={`${inpCls(fieldErrors.approxM2)} pr-10`}
              inputMode="decimal"
              placeholder="Ör. 12,5"
              value={form.approxM2}
              onChange={(e) => set("approxM2", e.target.value)}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
              m²
            </span>
          </div>
          {fieldErrors.approxM2 && (
            <p className={fieldErrCls}>{fieldErrors.approxM2}</p>
          )}
        </div>
        {drivers.length > 0 && (
          <div>
            <label htmlFor="manuel-sofor" className={labelCls}>
              Şoför
            </label>
            <select
              id="manuel-sofor"
              className={inpCls()}
              value={form.driverId}
              onChange={(e) => set("driverId", e.target.value)}
            >
              <option value="">Otomatik ata</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div>
        <label htmlFor="manuel-not" className={labelCls}>
          Not
          {optionalBadge}
        </label>
        <textarea
          id="manuel-not"
          className={inpCls()}
          rows={2}
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <IconWallet size={14} /> Tahsilat teslimde, kapıda nakit.
      </div>
      {err && (
        <p role="alert" className="text-sm text-red-600">
          {err}
        </p>
      )}
      <button
        disabled={loading}
        className="w-full rounded-xl bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? "Oluşturuluyor…" : "Kayıt Oluştur & Takip Kodu Üret"}
      </button>
    </form>
  );
}
