import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function fmtTL(n: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// Mali müşavir çalışma listesi: PLATFORMUN işletmelere abonelik faturası kesmesi
// için gereken her şey. YALNIZ tahsil edilmiş (PAID) ödemeler listelenir — her
// satır bir fatura kesilecek işlem. Fatura bilgileri işletmenin /panel/profil'de
// girdiği (ödeme öncesi zorunlu) alanlardan gelir.
export default async function MuhasebePage() {
  // YETKİ KAPISI prisma'dan ÖNCE (app-router-auth-leak): layout redirect'i RSC
  // veri sızıntısını tek başına engellemez — en hassas veriyi (çapraz-tenant
  // fatura/PII/ödeme) çeken bu sayfa kendi rol kontrolünü de yapmalı.
  const u = await getSessionUser();
  if (!u || (u.role !== "ACCOUNTANT" && u.role !== "ADMIN")) redirect("/giris");

  const payments = await prisma.subscriptionPayment.findMany({
    where: { status: "PAID" },
    orderBy: { paidAt: "desc" },
    include: {
      business: {
        select: {
          name: true,
          billingTitle: true,
          taxNumber: true,
          taxOffice: true,
          billingAddress: true,
          address: true,
          city: true,
          district: true,
          owner: { select: { email: true, phone: true } },
        },
      },
    },
  });

  const toplam = payments.reduce((s, p) => s + Number(p.amount), 0);

  const th =
    "px-3 py-2 text-left text-xs font-semibold text-slate-500 whitespace-nowrap";
  const td = "px-3 py-2 text-sm text-slate-800 align-top";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">
          Kesilecek Faturalar
        </h1>
        <p className="text-sm text-slate-500">
          {payments.length} ödeme · toplam {fmtTL(toplam)} TL (KDV dahil)
        </p>
      </div>

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Her satır, platformun ilgili işletmeye kestiği abonelik bedeli için bir
        e-Arşiv faturasıdır. Fatura, işletmenin ünvan / vergi no / vergi dairesi
        / adres bilgileriyle GİB portalından ya da muhasebe programından kesilir.
      </p>

      {payments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
          Henüz tahsil edilmiş abonelik ödemesi yok.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Ödeme tarihi</th>
                <th className={th}>Ünvan</th>
                <th className={th}>VKN / TCKN</th>
                <th className={th}>Vergi dairesi</th>
                <th className={th}>Adres</th>
                <th className={th}>İletişim</th>
                <th className={th}>Tutar (KDV dahil)</th>
                <th className={th}>Dönem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => {
                const b = p.business;
                const eksik = !b.billingTitle || !b.taxNumber || !b.taxOffice;
                const adres =
                  b.billingAddress ||
                  [b.address, b.district, b.city].filter(Boolean).join(", ");
                return (
                  <tr key={p.id} className={eksik ? "bg-red-50" : ""}>
                    <td className={td}>{fmtDate(p.paidAt)}</td>
                    <td className={td}>
                      <div className="font-medium">
                        {b.billingTitle || (
                          <span className="text-red-600">
                            (ünvan eksik — {b.name})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={td}>
                      {b.taxNumber || (
                        <span className="text-red-600">eksik</span>
                      )}
                    </td>
                    <td className={td}>
                      {b.taxOffice || (
                        <span className="text-red-600">eksik</span>
                      )}
                    </td>
                    <td className={`${td} max-w-xs`}>{adres || "—"}</td>
                    <td className={td}>
                      <div className="text-xs text-slate-500">
                        {b.owner.email ?? "—"}
                        <br />
                        {b.owner.phone}
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap font-medium`}>
                      {fmtTL(Number(p.amount))} TL
                    </td>
                    <td className={td}>
                      <span className="whitespace-nowrap text-xs text-slate-500">
                        {fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
