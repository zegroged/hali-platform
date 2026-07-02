"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ORDER_STATUS_META, CUSTOMER_FLOW } from "@/lib/orderStatus";
import { OrderStatusIcon, IconTruck } from "@/components/icons";
import type { OrderStatus } from "@prisma/client";

const LiveMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
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
  paymentMethod: string;
  business: { name: string; phone: string };
  events: { status: OrderStatus; note: string | null; at: string }[];
  driver: { name: string; lat: number; lng: number } | null;
};

export function TrackingClient({ token }: { token: string }) {
  const [data, setData] = useState<Track | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetch(`/api/orders/${token}`, { cache: "no-store" });
      if (!active) return;
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) setData(await res.json());
    }
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token]);

  if (notFound) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Takip bulunamadı. Bağlantıyı kontrol edin.
      </div>
    );
  }
  if (!data) {
    return <div className="py-10 text-center text-slate-400">Yükleniyor…</div>;
  }

  const rejected = data.status === "REJECTED";
  const canceled = data.status === "CANCELED";
  const currentIdx = CUSTOMER_FLOW.indexOf(data.status);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-500">{data.business.name}</p>
        <h1 className="text-xl font-bold text-slate-900">Halı Takibi</h1>
      </div>

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
            className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Başka halıcı seç
          </Link>
        </div>
      ) : canceled ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
          Bu talep iptal edildi.
        </div>
      ) : (
        <>
          {/* Durum adımları */}
          <div className="space-y-0">
            {CUSTOMER_FLOW.map((s, i) => {
              const meta = ORDER_STATUS_META[s];
              const done = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <div key={s} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        done
                          ? "bg-brand text-white"
                          : "bg-slate-200 text-slate-400"
                      }`}
                    >
                      <OrderStatusIcon status={s} size={16} />
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
                    <p
                      className={`text-sm font-medium ${
                        active
                          ? "text-brand-dark"
                          : done
                            ? "text-slate-800"
                            : "text-slate-400"
                      }`}
                    >
                      {meta.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Şoför haritası (yolda iken) */}
          {data.driver && data.driver.lat != null && (
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
          )}
        </>
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
                <span className="text-slate-400">
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
    </div>
  );
}
