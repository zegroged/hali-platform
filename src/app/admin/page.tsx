import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifMeta, subscriptionLabel } from "@/lib/verifMeta";
import { subscriptionActive } from "@/lib/subscription";
import { approveBusiness } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  // YETKİ KAPISI — prisma sorgularından ÖNCE (layout redirect'i RSC sızıntısını
  // tek başına engellemez; işletme listesi yetkisiz akışa girerdi).
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") redirect("/giris");

  const { hata } = await searchParams;

  const [businesses, driverCount, orderCount, cityLeads, staleOrders] =
    await Promise.all([
    prisma.cleanerBusiness.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subscription: true,
        _count: { select: { drivers: true, orders: true } },
      },
    }),
    prisma.driver.count(),
    prisma.order.count(),
    // "Açılınca haber ver" kayıtları — hangi şehirde müşteri talebi birikiyor
    // (işletme kazanım görüşmelerinde koz: "X şehrinde N kişi bekliyor").
    prisma.cityLead.groupBy({
      by: ["city"],
      _count: true,
      orderBy: { _count: { city: "desc" } },
    }),
    // SLA: 2 saatten uzun süredir yanıtsız siparişler — hangi işletme
    // siparişleri çürütüyor, admin bir bakışta görsün.
    prisma.order.findMany({
      where: {
        status: "CREATED",
        createdAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        id: true,
        code: true,
        trackingToken: true,
        customerName: true,
        createdAt: true,
        business: { select: { id: true, name: true } },
      },
    }),
  ]);

  const pending = businesses.filter((b) => b.verification === "PENDING");
  const live = businesses.filter(
    (b) =>
      b.verification === "VERIFIED" &&
      b.isVisible &&
      subscriptionActive(b.subscription),
  ).length;

  // Gözetim sayaçları — platformun bir bakışta durumu
  const stats = [
    { label: "İşletme", value: businesses.length },
    { label: "Onay bekleyen", value: pending.length },
    { label: "Yayında", value: live },
    { label: "Şoför", value: driverCount },
    { label: "Sipariş", value: orderCount },
  ];

  return (
    <div className="space-y-6">
      {/* Server action'lardan dönen dostane hata (örn. eksik profille onay) */}
      {hata && (
        <p
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {hata}
        </p>
      )}

      {/* Admin işlemleri */}
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href="/admin/mali-musavir"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Mali Müşavir
        </Link>
        <Link
          href="/admin/yeni"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          + Yeni İşletme
        </Link>
      </div>

      {/* Sayaçlar */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm"
          >
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              {s.value}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Şehir talepleri — boş şehir sayfalarında bırakılan "haber ver"
          e-postaları. Hangi şehirde halıcı aranacağının verisi. */}
      {cityLeads.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-baseline justify-between font-semibold text-slate-900">
            <span>
              Şehir talepleri{" "}
              <span className="text-sm font-normal text-slate-500">
                (açılınca haber ver kayıtları)
              </span>
            </span>
            <Link
              href="/admin/talepler"
              className="text-sm font-medium text-brand-dark hover:underline"
            >
              Tümü / CSV
            </Link>
          </h2>
          <div className="flex flex-wrap gap-2">
            {cityLeads.map((l) => (
              <span
                key={l.city}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
              >
                {l.city}
                <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand-dark">
                  {l._count}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* SLA: 2 saati aşmış yanıtsız siparişler — sessizlik pazar yeri öldürür */}
      {staleOrders.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-red-700">
            Geciken siparişler{" "}
            <span className="text-sm font-normal text-slate-500">
              (2 saatten uzun süredir yanıtsız)
            </span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-red-200 bg-white">
            {staleOrders.map((o) => {
              const hours = Math.floor(
                (Date.now() - o.createdAt.getTime()) / (60 * 60 * 1000),
              );
              return (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 text-sm last:border-0"
                >
                  <span>
                    <Link
                      href={`/admin/isletme/${o.business.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {o.business.name}
                    </Link>{" "}
                    · {o.customerName} · {o.code ?? o.trackingToken}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      hours >= 24
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {hours} saattir bekliyor
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Rozet bekleyenler — yayın onaya bağlı DEĞİL (otomatik); burası yalnız
          "Doğrulanmış" rozeti incelemesi. Yayından kaldırma/engel: İncele sayfası. */}
      <section>
        <h1 className="mb-3 text-lg font-semibold text-slate-900">
          Doğrulanmış Rozeti Bekleyenler ({pending.length})
        </h1>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            Bekleyen rozet başvurusu yok.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <Link
                  href={`/admin/isletme/${b.id}`}
                  className="font-medium text-slate-900 hover:text-brand-dark hover:underline"
                >
                  {b.name}
                </Link>
                <p className="text-sm text-slate-500">
                  {b.district}, {b.city} · Vergi No: {b.taxNumber ?? "—"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={approveBusiness}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
                      Rozet ver ✓
                    </button>
                  </form>
                  <Link
                    href={`/admin/isletme/${b.id}`}
                    className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand-dark"
                  >
                    İncele →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tüm işletmeler — satıra tıkla → tam denetim sayfası */}
      <section>
        <h2 className="mb-3 font-semibold text-slate-900">Tüm İşletmeler</h2>
        <div className="no-scrollbar overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">İşletme</th>
                <th className="px-4 py-2">Durum</th>
                <th className="px-4 py-2">Görünür</th>
                <th className="px-4 py-2">Abonelik</th>
                <th className="px-4 py-2 text-right">Şoför / Sipariş</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => {
                const verif = verifMeta(b.verification);
                return (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/isletme/${b.id}`}
                        className="font-medium text-slate-800 hover:text-brand-dark hover:underline"
                      >
                        {b.name}
                      </Link>
                      <div className="text-xs text-slate-500">{b.district}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${verif.cls}`}
                      >
                        {verif.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{b.isVisible ? "✓" : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {subscriptionLabel(b.subscription?.status)}
                      {b.subscription?.currentPeriodEnd && (
                        <span className="ml-1 text-xs text-slate-400">
                          →{" "}
                          {b.subscription.currentPeriodEnd.toLocaleDateString(
                            "tr-TR",
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {b._count.drivers} / {b._count.orders}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/isletme/${b.id}`}
                        className="whitespace-nowrap text-sm font-medium text-brand-dark hover:underline"
                      >
                        İncele →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
