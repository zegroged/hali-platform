import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { ORDER_STATUS_META, REJECT_REASONS } from "@/lib/orderStatus";
import { OrderStatusIcon } from "@/components/icons";
import { reassignOrder, cancelOrder, rejectOrder } from "../actions";

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
  const b = await getCurrentBusiness();
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
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          Henüz sipariş yok.
        </p>
      )}

      {orders.map((o) => {
        const meta = ORDER_STATUS_META[o.status];
        const closed = ["DELIVERED", "CANCELED", "REJECTED"].includes(o.status);
        return (
          <div
            key={o.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{o.customerName}</p>
                <p className="text-sm text-slate-500">{o.customerPhone}</p>
                <p className="mt-1 text-sm text-slate-600">{o.pickupAddress}</p>
                {o.approxM2 && (
                  <p className="text-xs text-slate-400">~{o.approxM2} m²</p>
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

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-sm text-slate-500">
                Şoför: {o.driver?.user.name ?? "—"}
              </span>

              {!closed && (
                <>
                  <form action={reassignOrder} className="flex items-center gap-1">
                    <input type="hidden" name="orderId" value={o.id} />
                    <select
                      name="driverId"
                      defaultValue={o.driverId ?? ""}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">(atanmamış)</option>
                      {b.drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.user.name}
                        </option>
                      ))}
                    </select>
                    <button className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white">
                      Ata
                    </button>
                  </form>

                  <form action={cancelOrder}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <button className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600">
                      İptal
                    </button>
                  </form>

                  {(o.status === "CREATED" || o.status === "ACCEPTED") && (
                    <form action={rejectOrder} className="flex items-center gap-1">
                      <input type="hidden" name="orderId" value={o.id} />
                      <select
                        name="reason"
                        defaultValue=""
                        required
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="" disabled>
                          Ret sebebi
                        </option>
                        {REJECT_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button className="rounded border border-red-400 px-2 py-1 text-xs font-medium text-red-700">
                        Reddet
                      </button>
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
