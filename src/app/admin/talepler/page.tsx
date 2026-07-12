import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Şehir talepleri: boş şehir/ilçe sayfalarında bırakılan "açılınca haber ver"
 * e-postaları — hangi şehirde müşteri beklediğinin verisi. İşletme kazanım
 * görüşmelerinde koz; şehir açılınca müjde maili OTOMATİK gider (cityLeads.ts).
 */
export default async function AdminCityLeads() {
  // YETKİ KAPISI — prisma'dan ÖNCE (RSC sızıntısı dersi: layout'a güvenme).
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") redirect("/giris");

  const leads = await prisma.cityLead.findMany({
    orderBy: [{ city: "asc" }, { createdAt: "desc" }],
  });

  const byCity = new Map<string, typeof leads>();
  for (const l of leads) {
    const arr = byCity.get(l.city) ?? [];
    arr.push(l);
    byCity.set(l.city, arr);
  }
  // Çok bekleyeni olan şehir üstte — önce oraya halıcı bulunmalı.
  const cities = [...byCity.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Şehir talepleri
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            &quot;Açılınca haber ver&quot; kayıtları — şehir açıldığında müjde
            maili otomatik gider.
          </p>
        </div>
        {leads.length > 0 && (
          <a
            href="/admin/talepler/csv"
            className="shrink-0 rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand-dark transition hover:bg-brand-light"
          >
            CSV indir
          </a>
        )}
      </div>

      {cities.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">
          Henüz kayıt yok. Boş şehir/ilçe sayfalarındaki &quot;haber ver&quot;
          kutusundan gelenler burada birikir.
        </p>
      ) : (
        cities.map(([city, rows]) => (
          <section
            key={city}
            className="rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <h2 className="flex items-center justify-between border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
              {city}
              <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
                {rows.length} kişi bekliyor
              </span>
            </h2>
            <div className="divide-y divide-slate-100">
              {rows.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <span className="font-medium text-slate-800">{l.email}</span>
                  <span className="text-xs text-slate-500">
                    {l.district ? `${l.district} · ` : ""}
                    {l.createdAt.toLocaleDateString("tr-TR")}
                    {l.notifiedAt
                      ? ` · müjde maili gitti (${l.notifiedAt.toLocaleDateString("tr-TR")})`
                      : " · bekliyor"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <Link href="/admin" className="text-sm text-brand-dark hover:underline">
        ← Admin paneline dön
      </Link>
    </div>
  );
}
