import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPanelBusiness } from "@/lib/panel";
import { ORDER_STATUS_META, REJECT_REASONS } from "@/lib/orderStatus";
import {
  OrderStatusIcon,
  IconReceipt,
  IconChevronRight,
} from "@/components/icons";
import EmptyState from "@/components/EmptyState";
import {
  reassignOrder,
  cancelOrder,
  rejectOrder,
  acceptOrderPanel,
} from "../actions";
import { ConfirmButton } from "../ConfirmButton";
import { PendingButton } from "@/components/PendingButton";

const STATUS_CLS: Record<string, string> = {
  CREATED: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  PICKED_UP: "bg-indigo-100 text-indigo-700",
  WASHING: "bg-cyan-100 text-cyan-700",
  OUT_FOR_DELIVERY: "bg-violet-100 text-violet-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELED: "bg-slate-200 text-slate-600",
};

export default async function PanelOrders() {
  const b = await getPanelBusiness();
  if (!b) return null;

  const orders = await prisma.order.findMany({
    where: { businessId: b.id },
    orderBy: { createdAt: "desc" },
    include: { driver: { include: { user: { select: { name: true } } } } },
  });

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-slate-900">Siparişler</h1>

      {orders.length === 0 && (
        <EmptyState
          icon={<IconReceipt size={22} />}
          title="Henüz sipariş yok"
          description="Dükkânına gelen ilk müşterin için kayıt oluştur; sistem otomatik bir takip kodu üretir."
          actionHref="/panel/yeni-siparis"
          actionLabel="İlk kaydını oluştur"
        />
      )}

      {orders.map((o) => {
        const meta = ORDER_STATUS_META[o.status];
        const closed = ["DELIVERED", "CANCELED", "REJECTED"].includes(o.status);
        return (
          <div
            key={o.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{o.customerName}</p>
                <p className="text-sm text-slate-500">{o.customerPhone}</p>
                <p className="mt-1 text-sm text-slate-600">{o.pickupAddress}</p>
                {o.approxM2 && (
                  <p className="text-xs text-slate-500">~{o.approxM2} m²</p>
                )}
                {o.note && (
                  <p className="mt-1 text-xs italic text-slate-500">
                    Not: {o.note}
                  </p>
                )}
                {o.status === "REJECTED" && o.rejectReason && (
                  <p className="mt-1 text-xs text-red-600">
                    Red sebebi: {o.rejectReason}
                  </p>
                )}
              </div>
              <span
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLS[o.status]}`}
              >
                <OrderStatusIcon status={o.status} size={12} /> {meta.label}
              </span>
            </div>

            {/* Aksiyonlar: mobilde alt alta, geniş ekranda yan yana.
                Renk hiyerarşisi — Ata: dolgulu marka, İptal: nötr gri, Reddet: kırmızı. */}
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-end">
              <span className="text-sm text-slate-500 sm:self-center">
                Şoför: {o.driver?.user.name ?? "—"}
              </span>

              <Link
                href={`/panel/siparisler/${o.id}`}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-light/50 sm:order-last sm:ml-auto"
              >
                Yönet
                <IconChevronRight size={14} />
              </Link>

              {o.status === "CREATED" && (
                <form action={acceptOrderPanel}>
                  <input type="hidden" name="orderId" value={o.id} />
                  <PendingButton className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60 sm:w-auto">
                    Onayla
                  </PendingButton>
                </form>
              )}

              {!closed && (
                <>
                  <form
                    action={reassignOrder}
                    className="flex flex-wrap items-end gap-1.5"
                  >
                    <input type="hidden" name="orderId" value={o.id} />
                    <div className="min-w-0 flex-1 sm:flex-none">
                      <span className="block text-xs font-medium text-slate-500">
                        Şoför ata
                      </span>
                      <select
                        name="driverId"
                        defaultValue={o.driverId ?? ""}
                        aria-label="Şoför ata"
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm sm:w-auto"
                      >
                        <option value="">(atanmamış)</option>
                        {b.drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.user.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <PendingButton className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60">
                      Ata
                    </PendingButton>
                  </form>

                  <form action={cancelOrder}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <ConfirmButton
                      message="Sipariş iptal edilsin mi?"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:w-auto"
                    >
                      İptal
                    </ConfirmButton>
                  </form>

                  {(o.status === "CREATED" || o.status === "ACCEPTED") && (
                    <form
                      action={rejectOrder}
                      className="flex flex-wrap items-end gap-1.5"
                    >
                      <input type="hidden" name="orderId" value={o.id} />
                      <div className="min-w-0 flex-1 sm:flex-none">
                        <span className="block text-xs font-medium text-slate-500">
                          Ret sebebi
                        </span>
                        <select
                          name="reason"
                          defaultValue=""
                          required
                          aria-label="Ret sebebi"
                          className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm sm:w-auto"
                        >
                          <option value="" disabled>
                            Seç…
                          </option>
                          {REJECT_REASONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      <PendingButton className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
                        Reddet
                      </PendingButton>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
