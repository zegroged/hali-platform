"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconMapPin, IconWallet, IconCheck } from "@/components/icons";

/** Alan bazlı doğrulama hataları (alan adı → mesaj). */
type FieldErrors = Partial<
  Record<"customerName" | "customerPhone" | "pickupAddress" | "approxM2", string>
>;

/** m² metnini sayıya çevirir; Türkçe virgüllü ondalık da kabul eder. */
function parseM2(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function OrderForm({
  businessId,
}: {
  businessId: string;
  // businessName sayfa başlığında gösterildiği için form içinde kullanılmıyor.
  businessName?: string;
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
  const [geoState, setGeoState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setGeoState("error");
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("idle");
      },
      () => setGeoState("error"),
      { timeout: 10000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Alan bazlı doğrulama — hatalı alan işaretlenir, mesajı altında gösterilir.
    const errs: FieldErrors = {};
    if (!form.customerName.trim()) errs.customerName = "Ad soyad gerekli.";
    if (form.customerPhone.length < 10)
      errs.customerPhone = "Telefon 05xx ile başlamalı ve 11 hane olmalı.";
    if (form.pickupAddress.trim().length < 5)
      errs.pickupAddress = "Lütfen açık adresi yaz (mahalle, sokak, no).";
    if (form.approxM2 && parseM2(form.approxM2) === null)
      errs.approxM2 = "Geçerli bir m² değeri gir (ör. 12,5).";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError("Lütfen işaretli alanları düzelt.");
      return;
    }

    setLoading(true);
    try {
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
          approxM2: form.approxM2
            ? (parseM2(form.approxM2) ?? undefined)
            : undefined,
          note: form.note || undefined,
          paymentMethod: form.paymentMethod,
        }),
      });
      if (!res.ok) {
        setError("Sipariş oluşturulamadı. Bilgileri kontrol edin.");
        return;
      }
      const data = await res.json();
      // ?yeni=1 → takip sayfası ilk açılışta onay bandı gösterir.
      router.push(`/takip/${data.trackingToken}?yeni=1`);
    } catch {
      setError("Bağlantı hatası, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  const inputBase = "w-full rounded-lg border px-3 py-2 text-sm focus:border-brand";
  const inputCls = (bad?: string) =>
    `${inputBase} ${bad ? "border-red-500" : "border-slate-300"}`;
  const labelCls = "mb-1 block text-sm font-medium text-slate-700";
  const fieldErrCls = "mt-1 text-xs text-red-600";
  const optionalBadge = (
    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      opsiyonel
    </span>
  );

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-4">
      {/* İşletme adı sayfa başlığında zaten var; burada tekrarlanmaz. */}
      {/* Blok 1 — iletişim bilgileri */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">
          İletişim bilgilerin
        </h2>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="siparis-ad" className={labelCls}>
              Ad Soyad
            </label>
            <input
              id="siparis-ad"
              className={inputCls(fieldErrors.customerName)}
              autoComplete="name"
              value={form.customerName}
              onChange={(e) => set("customerName", e.target.value)}
            />
            {fieldErrors.customerName && (
              <p className={fieldErrCls}>{fieldErrors.customerName}</p>
            )}
          </div>
          <div>
            <label htmlFor="siparis-telefon" className={labelCls}>
              Telefon
            </label>
            <input
              id="siparis-telefon"
              className={inputCls(fieldErrors.customerPhone)}
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
        </div>
      </section>

      {/* Blok 2 — alım adresi ve halı bilgisi */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">
          Halı nereden alınacak?
        </h2>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="siparis-adres" className={labelCls}>
              Halının alınacağı adres
            </label>
            <textarea
              id="siparis-adres"
              className={inputCls(fieldErrors.pickupAddress)}
              autoComplete="street-address"
              rows={2}
              value={form.pickupAddress}
              onChange={(e) => set("pickupAddress", e.target.value)}
            />
            {fieldErrors.pickupAddress && (
              <p className={fieldErrCls}>{fieldErrors.pickupAddress}</p>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={captureLocation}
              disabled={geoState === "loading"}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <IconMapPin size={15} />
              {coords
                ? "Konum eklendi"
                : geoState === "loading"
                  ? "Konum alınıyor…"
                  : "Konumumu ekle"}
              {coords && <IconCheck size={14} />}
            </button>
            {geoState === "error" ? (
              <p className="mt-1 text-xs text-slate-500">
                Konum alınamadı — adresi eksiksiz yazman yeterli.
              </p>
            ) : (
              !coords && (
                <p className="mt-1 text-xs text-slate-500">
                  Opsiyonel — şoförün adresi bulmasını kolaylaştırır.
                </p>
              )
            )}
          </div>
          <div>
            <label htmlFor="siparis-m2" className={labelCls}>
              Yaklaşık m²
              {optionalBadge}
            </label>
            <div className="relative">
              <input
                id="siparis-m2"
                className={`${inputCls(fieldErrors.approxM2)} pr-10`}
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
          <div>
            <label htmlFor="siparis-not" className={labelCls}>
              Ek not
              {optionalBadge}
            </label>
            <textarea
              id="siparis-not"
              className={inputCls()}
              rows={2}
              placeholder="Ör. kapıcıya bırakılabilir, 3. kat"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <IconWallet size={16} />
        <span>
          Ödeme <span className="font-medium">teslimde, kapıda nakit</span> alınır.
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <p className="text-xs text-slate-500">
        Talebi oluşturarak{" "}
        <Link href="/kvkk" className="underline hover:text-slate-700">
          KVKK aydınlatma metnini
        </Link>{" "}
        ve{" "}
        <Link href="/kosullar" className="underline hover:text-slate-700">
          kullanım koşullarını
        </Link>{" "}
        kabul etmiş olursun. Bilgilerin yalnızca seçtiğin halıcı ile paylaşılır.
      </p>

      <button
        disabled={loading}
        className="w-full rounded-xl bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? "Gönderiliyor…" : "Talebi Oluştur"}
      </button>
    </form>
  );
}
