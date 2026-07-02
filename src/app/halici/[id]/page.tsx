import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessById } from "@/lib/businesses";
import { Badges } from "@/components/Badges";
import { IconTruck } from "@/components/icons";

const DAYS: [string, string][] = [
  ["mon", "Pazartesi"],
  ["tue", "Salı"],
  ["wed", "Çarşamba"],
  ["thu", "Perşembe"],
  ["fri", "Cuma"],
  ["sat", "Cumartesi"],
  ["sun", "Pazar"],
];

const UNIT_LABEL: Record<string, string> = {
  PER_M2: "/ m²",
  PER_PIECE: "/ adet",
  FLAT: "(sabit)",
};

export default async function HaliciProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const b = await getBusinessById(id);
  if (!b) notFound();

  const main = b.pricing.filter((p) => !p.isAddon);
  const addons = b.pricing.filter((p) => p.isAddon);
  const hours = (b.workingHours ?? {}) as Record<
    string,
    { open: string; close: string } | null
  >;

  return (
    <main className="mx-auto max-w-lg px-4 py-6 pb-28">
      <Link href="/" className="text-sm text-brand-dark hover:underline">
        ← Halıcılar
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{b.name}</h1>
          <p className="text-slate-500">
            {b.district}, {b.city}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-lg font-bold text-slate-900">
            <span className="text-amber-500">★</span>
            {b.ratingAvg.toFixed(1)}
          </div>
          <div className="text-xs text-slate-400">{b.ratingCount} yorum</div>
        </div>
      </div>

      <div className="mt-3">
        <Badges badges={b.badges} />
      </div>

      {/* Fotoğraflar (before/after) */}
      {b.photos.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          {b.photos.map((p, i) => (
            <div
              key={i}
              className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? ""}
                className="h-full w-full object-cover"
              />
              <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-white">
                {p.isBefore ? "Öncesi" : "Sonrası"}
              </span>
            </div>
          ))}
        </div>
      )}

      {b.description && (
        <p className="mt-4 text-sm text-slate-600">{b.description}</p>
      )}

      <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-light px-3 py-2 text-sm font-medium text-brand-dark">
        <IconTruck size={16} /> Tahmini teslim:{" "}
        {b.deliveryMinDays != null && b.deliveryMaxDays != null
          ? `${b.deliveryMinDays}-${b.deliveryMaxDays} iş günü`
          : "Belirtilmedi"}
      </div>

      {/* Fiyatlandırma */}
      <section className="mt-6">
        <h2 className="mb-2 font-semibold text-slate-900">Fiyatlandırma</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          {main.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-0"
            >
              <span className="text-slate-700">{p.label}</span>
              <span className="font-medium text-slate-900">
                {p.price} TL {UNIT_LABEL[p.unit]}
              </span>
            </div>
          ))}
        </div>
        {addons.length > 0 && (
          <>
            <h3 className="mb-1 mt-3 text-sm font-semibold text-slate-700">
              Ek hizmetler
            </h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {addons.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-0"
                >
                  <span className="text-slate-700">{p.label}</span>
                  <span className="font-medium text-slate-900">
                    {p.price} TL {UNIT_LABEL[p.unit]}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Kesin fiyat, halı alındıktan ve görüldükten sonra netleşir.
        </p>
      </section>

      {/* Çalışma saatleri */}
      <section className="mt-6">
        <h2 className="mb-2 font-semibold text-slate-900">Çalışma Saatleri</h2>
        <div className="rounded-lg border border-slate-200 text-sm">
          {DAYS.map(([key, label]) => {
            const h = hours[key];
            return (
              <div
                key={key}
                className="flex justify-between border-b border-slate-100 px-3 py-1.5 last:border-0"
              >
                <span className="text-slate-600">{label}</span>
                <span className="text-slate-900">
                  {h ? `${h.open} - ${h.close}` : "Kapalı"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Yorumlar */}
      {b.reviews.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold text-slate-900">Yorumlar</h2>
          <div className="space-y-2">
            {b.reviews.map((r, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">
                    {r.customerName}
                  </span>
                  <span className="text-amber-500">
                    {"★".repeat(r.rating)}
                    <span className="text-slate-300">
                      {"★".repeat(5 - r.rating)}
                    </span>
                  </span>
                </div>
                {r.comment && (
                  <p className="mt-1 text-sm text-slate-600">{r.comment}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sabit CTA */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-3">
        <div className="mx-auto max-w-lg">
          <Link
            href={`/halici/${b.id}/siparis`}
            className="block rounded-xl bg-brand py-3 text-center font-semibold text-white hover:bg-brand-dark"
          >
            Halımı Aldır
          </Link>
        </div>
      </div>
    </main>
  );
}
