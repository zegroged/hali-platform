import { prisma } from "@/lib/prisma";
import { approveBusiness, rejectBusiness } from "./actions";

const VERIF_CLS: Record<string, string> = {
  VERIFIED: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
};

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const businesses = await prisma.cleanerBusiness.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: true,
      _count: { select: { drivers: true, orders: true } },
    },
  });

  const pending = businesses.filter((b) => b.verification === "PENDING");

  return (
    <div className="space-y-6">
      {/* Onay bekleyenler */}
      <section>
        <h1 className="mb-3 text-lg font-semibold text-slate-900">
          Onay Bekleyen İşletmeler ({pending.length})
        </h1>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400">
            Bekleyen başvuru yok.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <p className="font-medium text-slate-900">{b.name}</p>
                <p className="text-sm text-slate-500">
                  {b.district}, {b.city} · Vergi No: {b.taxNumber ?? "—"}
                </p>
                <div className="mt-3 flex gap-2">
                  <form action={approveBusiness}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
                      Onayla ✓
                    </button>
                  </form>
                  <form action={rejectBusiness}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600">
                      Reddet
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tüm işletmeler */}
      <section>
        <h2 className="mb-3 font-semibold text-slate-900">Tüm İşletmeler</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-400">
              <tr>
                <th className="px-4 py-2">İşletme</th>
                <th className="px-4 py-2">Durum</th>
                <th className="px-4 py-2">Görünür</th>
                <th className="px-4 py-2">Abonelik</th>
                <th className="px-4 py-2 text-right">Şoför / Sipariş</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{b.name}</div>
                    <div className="text-xs text-slate-400">{b.district}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${VERIF_CLS[b.verification]}`}
                    >
                      {b.verification}
                    </span>
                  </td>
                  <td className="px-4 py-2">{b.isVisible ? "✓" : "—"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {b.subscription?.status ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {b._count.drivers} / {b._count.orders}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
