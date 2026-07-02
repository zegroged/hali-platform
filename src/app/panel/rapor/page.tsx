import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { STOP_MIN_SEC } from "@/lib/tracking";

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
        <h1 className="text-lg font-semibold text-slate-900">
          Şoför Durak Raporu
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/panel/rapor?ym=${prev}`}
            className="rounded border border-slate-300 px-2 py-1"
          >
            ‹
          </Link>
          <span className="font-medium">
            {MONTHS[month - 1]} {year}
          </span>
          <Link
            href={`/panel/rapor?ym=${next}`}
            className="rounded border border-slate-300 px-2 py-1"
          >
            ›
          </Link>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Şoförlerin bu ay nerede, ne zaman, ne kadar durduğunun kaydı.
      </p>

      {stops.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          Bu ay için kayıt yok.
        </p>
      )}

      {[...byDriver.entries()].map(([driverId, list]) => {
        const totalSec = list.reduce((a, s) => a + (s.durationSec ?? 0), 0);
        return (
          <div
            key={driverId}
            className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
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
              <thead className="text-left text-xs text-slate-400">
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
