"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconMapPin, IconWallet, IconCheck } from "@/components/icons";
import { LocationPicker } from "@/components/LocationPicker";

/** Alan bazlı doğrulama hataları (alan adı → mesaj). */
type FieldErrors = Partial<
  Record<
    "customerName" | "customerPhone" | "pickupAddress" | "approxM2" | "consent",
    string
  >
>;

/** m² metnini sayıya çevirir; Türkçe virgüllü ondalık da kabul eder. */
function parseM2(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function OrderForm({
  businessId,
  businessName,
  initial,
}: {
  businessId: string;
  businessName?: string;
  /** "Tekrar sipariş": önceki siparişten ön-doldurma (sunucu sayfası sahiplik
   *  kontrolünden geçirip verir; onay kutusu ASLA ön-işaretlenmez). */
  initial?: Partial<{
    customerName: string;
    customerPhone: string;
    pickupAddress: string;
    approxM2: string;
    note: string;
    pickupLat: number;
    pickupLng: number;
  }>;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    customerName: initial?.customerName ?? "",
    customerPhone: initial?.customerPhone ?? "",
    pickupAddress: initial?.pickupAddress ?? "",
    approxM2: initial?.approxM2 ?? "",
    note: initial?.note ?? "",
    paymentMethod: "CASH" as "CASH" | "CARD",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.pickupLat != null && initial?.pickupLng != null
      ? { lat: initial.pickupLat, lng: initial.pickupLng }
      : null,
  );
  const [geoState, setGeoState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  // Tarayıcının bildirdiği konum hatası (metre) — kaba konumu kullanıcıya söyle.
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  // Mesafeli Sözleşmeler Yönetmeliği md.7: ön bilgilendirmenin TEYİDİ —
  // işaretlenmemiş zorunlu onay kutusu; sunucu tarafında consentAt olarak loglanır.
  const [consent, setConsent] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setGeoState("error");
      return;
    }
    setGeoState("loading");
    setAccuracy(null);
    // enableHighAccuracy: GPS/Wi-Fi kullanır. Kapalıyken tarayıcı IP/baz-istasyonu
    // konumuna düşüyor ve kilometrelerce sapıyordu. maximumAge:0 → önbellekteki
    // eski (kaba) konumu kullanma; timeout uzun çünkü GPS kilidi zaman alır.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy ?? null);
        setGeoState("idle");
      },
      () => setGeoState("error"),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
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
    if (!consent)
      errs.consent = "Devam etmek için onay kutusunu işaretleyin.";
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
          consent,
        }),
      });
      if (!res.ok) {
        // Sunucunun gerçek mesajını göster (tatil modu, abonelik, şoför yok
        // gibi durumlar "bilgileri kontrol edin"le açıklanamaz).
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Sipariş oluşturulamadı. Bilgileri kontrol edin.");
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
                Konum alınamadı — adresi eksiksiz yaz veya haritadan işaretle.
              </p>
            ) : coords ? (
              // Tarayıcı konumu bazen kilometrelerce sapar (masaüstünde Wi-Fi/IP
              // tabanlı). Sapmayı açıkça söyle ve haritadan düzeltmeyi öner.
              accuracy != null && accuracy > 200 ? (
                <p className="mt-1 text-xs text-amber-700">
                  Konum yaklaşık ±{Math.round(accuracy)} m hassasiyetle alındı —
                  sapmış olabilir. Aşağıdaki haritadan kapını işaretleyip
                  düzeltebilirsin.
                </p>
              ) : (
                <p className="mt-1 text-xs text-emerald-700">
                  Konum alındı
                  {accuracy != null ? ` (±${Math.round(accuracy)} m)` : ""} —
                  haritadan düzeltebilirsin.
                </p>
              )
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Opsiyonel — şoförün adresi bulmasını kolaylaştırır.
              </p>
            )}
            <div className="mt-2">
              <LocationPicker
                value={coords}
                onChange={(c) => {
                  setCoords(c);
                  // Haritadan elle seçildi → tarayıcı hassasiyet uyarısı geçersiz.
                  setAccuracy(null);
                  if (!c) setGeoState("idle");
                }}
                addressHint={form.pickupAddress}
              />
            </div>
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

      {/* Mesafeli Sözleşmeler Yönetmeliği md.6/2: (a) temel nitelikler, (d) fiyat
          hesaplama usulü, (g)-(h) cayma bilgileri, ödeme yükümlülüğü altına
          girilmeden hemen önce bir bütün olarak gösterilir. md.6/1 "en az on
          iki punto" = 16px gereği bu blokta text-base ALTINA İNME. */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-base font-semibold text-slate-800">
          Sipariş Özeti — Önemli Bilgiler
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-base text-slate-700">
          <li>
            <span className="font-medium">Hizmet:</span> halının adresinizden
            alınması, yıkanması ve adresinize teslim edilmesi
            {businessName ? ` (seçilen işletme: ${businessName})` : ""}.
          </li>
          <li>
            <span className="font-medium">Fiyat:</span> işletmenin profilindeki
            birim tarifeye (TL/m²) göre hesaplanır; kesin tutar halı ölçüldükten
            sonra size bildirilir ve{" "}
            <span className="font-medium">onayınız alınır</span> — onaylamazsanız
            halınız yıkanmadan ücretsiz iade edilir.
          </li>
          <li>
            <span className="font-medium">Ödeme:</span> teslimde kapıda nakit
            (online kart ödemesi aktif olduğunda ayrıca duyurulur).
          </li>
          <li>
            <span className="font-medium">Cayma:</span> halı alınmadan ücretsiz
            iptal edebilirsiniz; kesin fiyatı onaylamanız ifaya başlama
            onayıdır, yıkama sonrası cayma hakkı yoktur (Yönetmelik md.15/1-h).
          </li>
          {/* md.8/1: sipariş onayından hemen önce, siparişin ödeme yükümlülüğü
              doğurduğunun açık bildirimi — iki aşamalı modele bağlanmış hali. */}
          <li>
            <span className="font-medium">Ödeme yükümlülüğü:</span> kesin
            fiyatı onaylamanız hâlinde bu sipariş, teslimde ödeme yükümlülüğü
            doğurur (Yönetmelik md.8/1).
          </li>
        </ul>
      </section>

      {/* md.7 teyidi: işaretlenmemiş zorunlu onay kutusu — işaretlenme anı
          sunucuda consentAt + contractVersion olarak kayda geçer. */}
      <div>
        <div className="flex items-start gap-3">
          <input
            id="siparis-onay"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
          />
          <label htmlFor="siparis-onay" className="text-base text-slate-700">
            <Link
              href="/on-bilgilendirme"
              className="font-medium text-brand-dark underline"
            >
              Ön Bilgilendirme Formu
            </Link>
            &apos;nu ve{" "}
            <Link
              href="/mesafeli-satis"
              className="font-medium text-brand-dark underline"
            >
              Mesafeli Satış Sözleşmesi
            </Link>
            &apos;ni okudum, onaylıyorum. Kesin fiyatı onaylamamla birlikte
            yıkamaya (hizmetin ifasına) başlanmasına onay vermiş olacağımı ve
            hizmet ifa edildikten sonra cayma hakkımın bulunmadığını biliyorum.
          </label>
        </div>
        {fieldErrors.consent && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.consent}</p>
        )}
      </div>

      {/* KVKK aydınlatması: Aydınlatma Tebliği md.5/1-f gereği bilgilendirmedir,
          onaya bağlanmaz — bu yüzden checkbox metninden AYRI tutulur.
          Tebliğ md.5/1-j: eksik/yanıltıcı bilgi verilmez — şoför paylaşımı ve
          teknik aktarımlar açıkça söylenir. */}
      <p className="text-base text-slate-500">
        Kişisel verileriniz{" "}
        <Link href="/kvkk" className="text-brand-dark underline">
          KVKK Aydınlatma Metni
        </Link>{" "}
        kapsamında işlenir; bilgileriniz yalnızca seçtiğiniz işletme ve
        teslimatı yapan şoförle paylaşılır. Teknik hizmet aktarımları için
        KVKK Aydınlatma Metni&apos;ne bakınız.
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
