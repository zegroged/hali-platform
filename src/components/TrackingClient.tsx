"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ORDER_STATUS_META, CUSTOMER_FLOW } from "@/lib/orderStatus";
import {
  OrderStatusIcon,
  IconTruck,
  IconPhone,
  IconCheck,
  IconMapPin,
  IconX,
} from "@/components/icons";
import type { OrderStatus } from "@prisma/client";

const LiveMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
      Harita yükleniyor…
    </div>
  ),
});

type Track = {
  status: OrderStatus;
  rejectReason: string | null;
  createdAt: string;
  customerName: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  priceTotal: number | null;
  // md.15/1-h: işletmenin bildirdiği kesin fiyat + müşterinin onay anı
  quotedPrice: number | null;
  priceApprovedAt: string | null;
  paymentMethod: string;
  estimatedDays: number | null;
  photos: { id: string; url: string }[];
  business: { name: string; phone: string };
  events: { status: OrderStatus; note: string | null; at: string }[];
  driver: { name: string; lat: number; lng: number } | null;
};

// Poll'un durdurulacağı nihai durumlar — teslim edilmiş sipariş sonsuza dek sorgulanmasın.
const FINAL_STATUSES: OrderStatus[] = ["DELIVERED", "REJECTED", "CANCELED"];

// Platform üzerinden cayma/iptalin mümkün olduğu durumlar (md.11/5) —
// yıkama başladıktan (WASHING) sonra buton görünmez.
const CUSTOMER_CANCELABLE: OrderStatus[] = ["CREATED", "ACCEPTED", "PICKED_UP"];

/** Zaman çizelgesiyle aynı iskelette skeleton — içerik gelince zıplama olmaz. */
function TrackingSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-slate-200" />
        <div className="h-6 w-44 rounded bg-slate-200" />
        <div className="h-3 w-36 rounded bg-slate-200" />
      </div>
      <div className="space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-slate-200" />
              {i < 5 && (
                <div className="w-0.5 flex-1 bg-slate-100" style={{ minHeight: 18 }} />
              )}
            </div>
            <div className="pb-4 pt-2">
              <div className="h-3 w-32 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrackingClient({ token }: { token: string }) {
  const [data, setData] = useState<Track | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Ardışık 3 başarısız denemeden sonra hata durumuna geçilir.
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [copied, setCopied] = useState(false);
  // ?yeni=1 → sipariş sonrası onay bandı (kapatılabilir)
  const searchParams = useSearchParams();
  const [bannerClosed, setBannerClosed] = useState(false);
  const showBanner = searchParams.get("yeni") === "1" && !bannerClosed;
  // Kesin fiyat onayı (md.15/1-h) + cayma/iptal (md.11/5) aksiyon durumları
  const [approvePending, setApprovePending] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelDone, setCancelDone] = useState(false);

  useEffect(() => {
    let active = true;
    let failCount = 0;
    let id: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const res = await fetch(`/api/orders/${token}`, { cache: "no-store" });
        if (!active) return;
        if (res.status === 404) {
          setNotFound(true);
          if (id) clearInterval(id);
          return;
        }
        // 404 dışındaki başarısız yanıtlar (429/500…) da hata dalına düşer.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: Track = await res.json();
        if (!active) return;
        failCount = 0;
        setFailed(false);
        setData(json);
        // Nihai durumda poll'u durdur.
        if (FINAL_STATUSES.includes(json.status) && id) clearInterval(id);
      } catch {
        if (!active) return;
        failCount += 1;
        if (failCount >= 3) {
          setFailed(true);
          if (id) clearInterval(id);
        }
      }
    }

    load();
    id = setInterval(load, 5000);
    return () => {
      active = false;
      if (id) clearInterval(id);
    };
  }, [token, retryKey]);

  function retry() {
    setFailed(false);
    setRetryKey((k) => k + 1);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(token.toUpperCase());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano erişilemedi (izin/eski tarayıcı) — sessiz geç.
    }
  }

  /** Tek seferlik POST aksiyonu; başarıda null, hatada Türkçe mesaj döner. */
  async function postAction(path: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/orders/${token}/${path}`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        return json && typeof json.error === "string"
          ? json.error
          : "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.";
      }
      return null;
    } catch {
      return "Bağlantı hatası — lütfen tekrar deneyin.";
    }
  }

  // Kesin fiyat onayı (md.15/1-h): onay anı sunucuda kayda geçer,
  // başarıda veri tazelenir → yeşil teyit satırı görünür.
  async function approvePrice() {
    setApprovePending(true);
    setApproveError(null);
    const err = await postAction("approve-price");
    if (err) setApproveError(err);
    else setRetryKey((k) => k + 1); // veriyi hemen tazele
    setApprovePending(false);
  }

  // Platform üzerinden cayma/iptal (md.11/5): bildirim kayda geçer,
  // işletmeye SMS ile iletilir, müşteriye ekranda + SMS ile teyit verilir.
  async function cancelOrder() {
    if (
      !window.confirm(
        "Siparişi iptal etmek / cayma hakkını kullanmak istediğine emin misin?",
      )
    )
      return;
    setCancelPending(true);
    setCancelError(null);
    const err = await postAction("cancel");
    if (err) setCancelError(err);
    else {
      setCancelDone(true);
      setRetryKey((k) => k + 1); // veriyi hemen tazele → iptal ekranı
    }
    setCancelPending(false);
  }

  if (notFound) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
        <p className="font-semibold text-slate-700">
          Bu koda ait sipariş bulunamadı
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Kodu halıcından aldığın SMS/mesajdan kontrol et.
        </p>
        <Link
          href="/takip"
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
        >
          Kodu yeniden gir
        </Link>
        <p className="mt-3 text-xs text-slate-500">
          İpucu: 0 (sıfır) ile O harfi kodlarda kullanılmaz.
        </p>
        <p className="mt-2">
          <Link href="/" className="text-sm text-brand-dark hover:underline">
            ← Ana sayfa
          </Link>
        </p>
      </div>
    );
  }

  if (failed && !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="font-semibold text-slate-700">Takip bilgisi alınamadı</p>
        <p className="mt-1 text-sm text-slate-500">
          Bağlantını kontrol edip tekrar dene.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!data) {
    return <TrackingSkeleton />;
  }

  const rejected = data.status === "REJECTED";
  const canceled = data.status === "CANCELED";
  const currentIdx = CUSTOMER_FLOW.indexOf(data.status);
  const shortAddress =
    data.pickupAddress.length > 40
      ? `${data.pickupAddress.slice(0, 40)}…`
      : data.pickupAddress;

  return (
    <div className="space-y-5">
      {showBanner && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <p>
            <span className="font-semibold">Talebin alındı!</span> Bu sayfayı
            kaydet — durumu buradan takip edebilirsin.
          </p>
          <button
            type="button"
            onClick={() => setBannerClosed(true)}
            aria-label="Bildirimi kapat"
            className="shrink-0 rounded-lg p-1.5 text-emerald-700 transition hover:bg-emerald-100"
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {failed && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          <p>Takip bilgisi alınamadı — bağlantını kontrol et.</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
          >
            Tekrar dene
          </button>
        </div>
      )}

      <div>
        <p className="text-sm text-slate-500">{data.business.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Halı Takibi
          </h1>
          {/* Kopyalanabilir sipariş kodu chip'i */}
          <button
            type="button"
            onClick={copyCode}
            aria-label="Sipariş kodunu kopyala"
            title="Kodu kopyala"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 font-mono text-sm font-semibold tracking-wider text-slate-700 transition hover:bg-slate-50"
          >
            {token.toUpperCase()}
            {copied && <IconCheck size={14} className="text-emerald-600" />}
          </button>
          {copied && (
            <span className="text-xs font-medium text-emerald-600" role="status">
              Kopyalandı
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Merhaba {data.customerName}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-slate-500">
          <IconMapPin size={14} /> {shortAddress}
        </p>
      </div>

      {/* Halıcıyla iletişim — reddedilmiş/iptal siparişte de görünür */}
      {data.business.phone && (
        <a
          href={`tel:${data.business.phone}`}
          className="inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-brand-light/50 active:scale-[0.99]"
        >
          <IconPhone size={16} /> Halıcıyı Ara · {data.business.phone}
        </a>
      )}

      {rejected ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-700">Talep reddedildi</p>
          {data.rejectReason && (
            <p className="mt-1 text-sm text-red-600">
              Sebep: {data.rejectReason}
            </p>
          )}
          <Link
            href="/"
            className="mt-3 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
          >
            Başka halıcı seç
          </Link>
        </div>
      ) : canceled ? (
        cancelDone ? (
          /* md.11/5: cayma bildirimine DERHAL teyit — ekranda + SMS ile */
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-emerald-800">
              <IconCheck size={16} className="shrink-0" />
              Cayma bildiriminiz işletmeye iletildi
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Siparişiniz iptal edildi; teyit SMS'i de gönderildi. Ücret talep
              edilmez.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
            Bu talep iptal edildi.
          </div>
        )
      ) : (
        <>
          {/* Halıcının verdiği tahmini teslim süresi */}
          {data.estimatedDays != null && data.status !== "DELIVERED" && (
            <div className="rounded-lg bg-brand-light px-3 py-2 text-sm font-medium text-brand-dark">
              Tahmini teslim: ~{data.estimatedDays} gün
            </div>
          )}

          {/* Kesin fiyat onayı (Mesafeli Söz. Yön. md.15/1-h): onayla birlikte
              yıkamaya başlanır; onay anı sipariş kaydına işlenir. */}
          {data.status === "PICKED_UP" &&
            data.quotedPrice != null &&
            !data.priceApprovedAt && (
              <div className="rounded-xl border-2 border-brand bg-brand-light/40 p-4">
                <p className="text-lg font-bold text-slate-900">
                  Kesin fiyat: {data.quotedPrice} TL
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Onayınızla yıkamaya hemen başlanır; hizmet ifa edildikten
                  sonra cayma hakkınız bulunmaz (Yönetmelik md.15/1-h).
                </p>
                {approveError && (
                  <p className="mt-2 text-sm text-red-600" role="alert">
                    {approveError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={approvePrice}
                  disabled={approvePending}
                  className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60 sm:w-auto"
                >
                  {approvePending ? "İşleniyor…" : "Fiyatı Onayla"}
                </button>
              </div>
            )}

          {/* Onay verildiyse kalıcı bilgi satırı (ispat müşteriye de görünür) */}
          {data.quotedPrice != null && data.priceApprovedAt && (
            <div
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
              role="status"
            >
              <IconCheck size={16} className="shrink-0" />
              Kesin fiyatı onayladınız: {data.quotedPrice} TL
            </div>
          )}

          {/* Durum adımları */}
          <div className="space-y-0">
            {CUSTOMER_FLOW.map((s, i) => {
              const meta = ORDER_STATUS_META[s];
              const done = i < currentIdx;
              const active = i === currentIdx;
              // Aktif adımın zaman damgası — aynı durumdan birden çok event varsa sonuncusu
              const stepEvents = data.events.filter((e) => e.status === s);
              const evt = stepEvents[stepEvents.length - 1];
              return (
                <div key={s} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        active
                          ? "animate-pulse bg-brand text-white ring-4 ring-brand/25"
                          : done
                            ? "bg-brand text-white"
                            : "bg-slate-200 text-slate-400"
                      }`}
                    >
                      {done ? (
                        <IconCheck size={16} />
                      ) : (
                        <OrderStatusIcon status={s} size={16} />
                      )}
                    </div>
                    {i < CUSTOMER_FLOW.length - 1 && (
                      <div
                        className={`w-0.5 flex-1 ${
                          i < currentIdx ? "bg-brand" : "bg-slate-200"
                        }`}
                        style={{ minHeight: 18 }}
                      />
                    )}
                  </div>
                  <div className="pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-sm font-medium ${
                          active
                            ? "text-brand-dark"
                            : done
                              ? "text-slate-800"
                              : "text-slate-500"
                        }`}
                      >
                        {meta.label}
                      </p>
                      {active && (
                        <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand-dark">
                          Şu anda
                        </span>
                      )}
                    </div>
                    {active && evt && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(evt.at).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Şoför haritası (yolda iken) */}
          {data.driver && data.driver.lat != null ? (
            <div>
              <p className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-slate-700">
                {data.driver.name} yolda <IconTruck size={16} />
              </p>
              <LiveMap
                height={260}
                follow={{ lat: data.driver.lat, lng: data.driver.lng }}
                markers={[
                  {
                    lat: data.driver.lat,
                    lng: data.driver.lng,
                    label: "Şoför",
                    kind: "driver",
                  },
                  ...(data.pickupLat != null && data.pickupLng != null
                    ? [
                        {
                          lat: data.pickupLat,
                          lng: data.pickupLng,
                          label: "Adresin",
                          kind: "pickup" as const,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          ) : data.status === "OUT_FOR_DELIVERY" ? (
            /* Şoför konumu henüz gelmediyse harita yüksekliğinde placeholder */
            <div className="flex h-[260px] flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-center">
              <IconTruck size={28} className="text-slate-500" />
              <p className="text-sm font-medium text-slate-600">
                Şoför yola çıktı — canlı konum birazdan burada görünecek.
              </p>
            </div>
          ) : null}
        </>
      )}

      {/* Halıcının eklediği fotoğraflar */}
      {data.photos.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Halınızdan kareler
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {data.photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt="Sipariş fotoğrafı"
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Geçmiş */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          İşlem geçmişi
        </h2>
        <div className="space-y-1">
          {data.events
            .slice()
            .reverse()
            .map((e, i) => (
              <div
                key={i}
                className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm"
              >
                <span className="inline-flex items-center gap-1.5 text-slate-700">
                  <OrderStatusIcon status={e.status} size={14} />
                  {e.note ?? ORDER_STATUS_META[e.status].label}
                </span>
                <span className="text-slate-500">
                  {new Date(e.at).toLocaleString("tr-TR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
        </div>
      </div>

      {data.priceTotal != null && (
        <div className="rounded-lg bg-brand-light px-3 py-2 text-sm font-medium text-brand-dark">
          Tutar: {data.priceTotal} TL ·{" "}
          {data.paymentMethod === "CARD" ? "Kartla" : "Kapıda nakit"}
        </div>
      )}

      {/* Platform üzerinden cayma/iptal (md.11/5) — yıkama başlamadan ve kesin
          fiyat onaylanmadan her an; sonrasında buton görünmez. */}
      {CUSTOMER_CANCELABLE.includes(data.status) && !data.priceApprovedAt && (
        <div className="border-t border-slate-100 pt-3">
          {cancelError && (
            <p className="mb-2 text-sm text-red-600" role="alert">
              {cancelError}
            </p>
          )}
          <button
            type="button"
            onClick={cancelOrder}
            disabled={cancelPending}
            className="text-sm text-slate-500 underline transition hover:text-slate-700 disabled:opacity-60"
          >
            {cancelPending ? "İşleniyor…" : "Siparişi iptal et / cayma bildir"}
          </button>
          <p className="mt-1 text-xs text-slate-400">
            Yıkamaya başlanmadan iptal/cayma ücretsizdir; bildiriminiz
            işletmeye anında iletilir ve kayda geçer.
          </p>
        </div>
      )}

      {/* Sözleşme metinlerine sipariş sonrası kalıcı erişim (6563 md.3/1-c) */}
      <div className="border-t border-slate-100 pt-3 text-sm text-slate-500">
        Sözleşme ve bilgilendirme metinleri:{" "}
        <Link href="/on-bilgilendirme" className="underline hover:text-slate-700">
          Ön Bilgilendirme
        </Link>{" "}
        ·{" "}
        <Link href="/mesafeli-satis" className="underline hover:text-slate-700">
          Mesafeli Satış Sözleşmesi
        </Link>{" "}
        ·{" "}
        <Link href="/iade" className="underline hover:text-slate-700">
          İptal ve İade
        </Link>
      </div>
    </div>
  );
}
