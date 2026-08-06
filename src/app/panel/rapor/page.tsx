import { sadeceSahip } from "@/lib/panelYetki";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { STOP_MIN_SEC } from "@/lib/tracking";
import EmptyState from "@/components/EmptyState";
import { IconClock } from "@/components/icons";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function fmtDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} dk`;
  return `${Math.floor(m / 60)} sa ${m % 60} dk`;
}

export default async function PanelReport({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  // 🔴 SAHİBE ÖZEL SAYFA (2026-08-06). Kapı PRISMA'DAN ÖNCE: App Router'da
  // layout ile page paralel render edilir, layout yönlendirse bile buradaki
  // sorgu çalışır ve veri RSC yükünde sızabilir.
  await sadeceSahip();

  const b = await getCurrentBusiness();
  if (!b) return null;

  const sp = await searchParams;
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (sp.ym) {
    const [y, m] = sp.ym.split("-").map(Number);
    if (y && m >= 1 && m <= 12) {
      year = y;
      month = m;
    }
  }

  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;

  // AY ÖZETİ (2026-08-03): alt menüdeki açıklama "Aylık ciro ve sayılar"
  // diyordu ama sayfa yalnız şoför duraklarını gösteriyordu — halıcı raporlara
  // girip ciro arıyor, durak listesi buluyordu. Ay penceresi TR takvimine göre.
  const ayBasi = new Date(Date.UTC(year, month - 1, 1, -3, 0, 0));
  const aySonu = new Date(Date.UTC(year, month, 1, -3, 0, 0));
  const [siparisler, teslimEdilen, tahsilat] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { businessId: b.id, createdAt: { gte: ayBasi, lt: aySonu } },
      _count: true,
    }),
    prisma.order.aggregate({
      where: {
        businessId: b.id,
        status: "DELIVERED",
        deliveredAt: { gte: ayBasi, lt: aySonu },
      },
      _sum: { priceTotal: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: {
        businessId: b.id,
        collectedAt: { gte: ayBasi, lt: aySonu },
      },
      _sum: { collectedAmount: true },
    }),
  ]);
  const toplamSiparis = siparisler.reduce((a, g) => a + g._count, 0);
  const iptalRed = siparisler
    .filter((g) => g.status === "CANCELED" || g.status === "REJECTED")
    .reduce((a, g) => a + g._count, 0);
  const ciro = Number(teslimEdilen._sum.priceTotal ?? 0);
  const teslimAdet = teslimEdilen._count;
  const tahsilEdilen = Number(tahsilat._sum.collectedAmount ?? 0);
  const ortSepet = teslimAdet > 0 ? ciro / teslimAdet : 0;
  const fmtTL = (n: number) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const driverIds = b.drivers.map((d) => d.id);
  const stops = await prisma.driverStop.findMany({
    where: {
      driverId: { in: driverIds },
      periodYear: year,
      periodMonth: month,
      durationSec: { gte: STOP_MIN_SEC }, // sadece gerçek duraklar (≥3 dk)
    },
    orderBy: { startedAt: "desc" },
    include: { driver: { include: { user: { select: { name: true } } } } },
  });

  // şoföre göre grupla
  const byDriver = new Map<string, typeof stops>();
  for (const s of stops) {
    const arr = byDriver.get(s.driverId) ?? [];
    arr.push(s);
    byDriver.set(s.driverId, arr);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Raporlar</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/panel/rapor?ym=${prev}`}
            aria-label="Önceki ay"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            ‹
          </Link>
          <span className="font-medium">
            {MONTHS[month - 1]} {year}
          </span>
          <Link
            href={`/panel/rapor?ym=${next}`}
            aria-label="Sonraki ay"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            ›
          </Link>
        </div>
      </div>

      {/* AY ÖZETİ */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { e: "Ciro", d: fmtTL(ciro) + " TL", a: "teslim edilen siparişler" },
          { e: "Tahsil edilen", d: fmtTL(tahsilEdilen) + " TL", a: "nakit + IBAN" },
          { e: "Teslim", d: String(teslimAdet), a: "bu ay tamamlanan" },
          { e: "Ortalama sepet", d: fmtTL(ortSepet) + " TL", a: "teslim başına" },
        ].map((k) => (
          <div key={k.e} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">{k.e}</div>
            <div className="mt-0.5 text-base font-bold leading-tight text-slate-900 sm:text-lg">
              {k.d}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">{k.a}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-600">
        Bu ay <strong>{toplamSiparis}</strong> sipariş geldi
        {iptalRed > 0 && (
          <>
            , <strong>{iptalRed}</strong> tanesi iptal/red oldu
          </>
        )}
        . Gelir-gider defterinin tamamı{" "}
        <Link href="/panel/kasa" className="text-brand-dark underline">
          KASA
        </Link>{" "}
        sayfasında.
      </p>

      <h2 className="pt-2 text-base font-semibold text-slate-900">
        Şoför Durak Raporu
      </h2>
      <p className="text-sm text-slate-500">
        Şoförlerin bu ay nerede, ne zaman, ne kadar durduğunun kaydı.
      </p>

      {stops.length === 0 && (
        <EmptyState
          icon={<IconClock size={22} />}
          title="Bu ay için kayıt yok"
          description="Şoförler mesaideyken konumlar otomatik kaydedilir; duraklamalar burada listelenir."
        />
      )}

      {[...byDriver.entries()].map(([driverId, list]) => {
        const totalSec = list.reduce((a, s) => a + (s.durationSec ?? 0), 0);
        return (
          <div
            key={driverId}
            className="no-scrollbar overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
              <span className="font-medium text-slate-800">
                {list[0].driver.user.name}
              </span>
              <span className="text-sm text-slate-500">
                {list.length} durak · toplam {fmtDuration(totalSec)}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">Tarih / Saat</th>
                  <th className="px-4 py-2">Konum</th>
                  <th className="px-4 py-2 text-right">Süre</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-t border-slate-50">
                    <td className="px-4 py-2 text-slate-700">
                      {new Date(s.startedAt).toLocaleString("tr-TR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {s.address ??
                        `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800">
                      {fmtDuration(s.durationSec)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
