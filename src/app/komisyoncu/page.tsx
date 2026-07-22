import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscriptionActive } from "@/lib/subscription";
import { generateReferralCode } from "./actions";
import { PendingButton } from "@/components/PendingButton";

export const dynamic = "force-dynamic";

const fmtTL = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTarih = (d: Date) =>
  d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Komisyoncu ekranı (YALNIZ AGENT rolü): kendi kodu, getirdiği işletmeler ve
// komisyon tahakkukları — salt-okunur. Admin/panele giremez.
export default async function KomisyoncuSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ yeni?: string; hata?: string }>;
}) {
  const { yeni, hata } = await searchParams;
  // YETKİ KAPISI prisma'dan ÖNCE (app-router-auth-leak dersi).
  const u = await getSessionUser();
  if (!u || u.role !== "AGENT") redirect("/giris");

  const agent = await prisma.agent.findUnique({
    where: { userId: u.id },
    include: {
      referrals: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          city: true,
          createdAt: true,
          subscription: { select: { status: true, currentPeriodEnd: true } },
        },
      },
      entries: {
        orderBy: { createdAt: "desc" },
        take: 60,
        include: { business: { select: { name: true } } },
      },
      codes: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: { usedByBusiness: { select: { name: true } } },
      },
    },
  });
  if (!agent) redirect("/giris");

  // Toplamlar take:60 penceresinden DEĞİL aggregate'ten (inceleme bulgusu).
  const [toplamAgg, odenenAgg] = await Promise.all([
    prisma.commissionEntry.aggregate({
      where: { agentId: agent.id },
      _sum: { amount: true },
    }),
    prisma.commissionEntry.aggregate({
      where: { agentId: agent.id, paidAt: { not: null } },
      _sum: { amount: true },
    }),
  ]);
  const toplam = Number(toplamAgg._sum.amount ?? 0);
  const odenen = Number(odenenAgg._sum.amount ?? 0);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Komisyoncu Paneli — {u.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Komisyon oranın: <strong>%{Number(agent.percent)}</strong> (KDV hariç
          net abonelik tutarı üzerinden). <strong>Her müşteri için aşağıdan
          TEK KULLANIMLIK kod üret</strong> — kod bir işletmeye bağlanınca
          yanar; işletmenin aboneliği yenilendikçe komisyonun işlemeye devam
          eder.
        </p>
      </div>

      {yeni && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Yeni kodun hazır:{" "}
          <span className="font-mono text-base font-bold">{yeni}</span> — bu
          kodu müşterine ver; kayıt sırasında girecek (tek kullanımlık).
        </p>
      )}
      {hata && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {hata}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Referans Kodların</h2>
            <p className="text-sm text-slate-500">
              Her müşteri için ayrı kod üret — aynı kod ikinci kez kullanılamaz.
            </p>
          </div>
          <form action={generateReferralCode}>
            <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
              + Kod Üret
            </PendingButton>
          </form>
        </div>
        {agent.codes.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {agent.codes.map((k) => (
              <li key={k.id} className="flex items-center justify-between py-2">
                <span className="font-mono font-semibold text-slate-800">
                  {k.code}
                </span>
                {k.usedAt ? (
                  <span className="text-xs text-slate-500">
                    Kullanıldı{k.usedByBusiness ? ` · ${k.usedByBusiness.name}` : ""}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Kullanıma hazır
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xl font-bold text-slate-900">
            {agent.referrals.length}
          </div>
          <div className="text-xs text-slate-500">Getirdiğin işletme</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xl font-bold text-slate-900">{fmtTL(toplam)} TL</div>
          <div className="text-xs text-slate-500">Toplam komisyon</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xl font-bold text-green-700">{fmtTL(odenen)} TL</div>
          <div className="text-xs text-slate-500">Ödenen</div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Getirdiğin İşletmeler</h2>
        {agent.referrals.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Henüz kodunla kaydolan işletme yok. Yukarıdan kod üretip müşterine
            ver — kayıt sırasında girer ya da yönetici senin adına bağlar.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {agent.referrals.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span>
                  {b.name}{" "}
                  <span className="text-xs text-slate-400">({b.city})</span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    subscriptionActive(b.subscription)
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {subscriptionActive(b.subscription)
                    ? "Abonelik aktif"
                    : "Abonelik pasif"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">
          Komisyon Kayıtları{" "}
          <span className="text-xs font-normal text-slate-400">(son 60)</span>
        </h2>
        {agent.entries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Henüz tahakkuk yok — getirdiğin işletme ilk abonelik ödemesini
            yaptığında burada görünür.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5">Tarih</th>
                  <th className="py-1.5">İşletme</th>
                  <th className="py-1.5">Komisyon</th>
                  <th className="py-1.5">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agent.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="py-1.5">{fmtTarih(e.createdAt)}</td>
                    <td className="py-1.5">{e.business.name}</td>
                    <td className="py-1.5 font-medium">
                      {fmtTL(Number(e.amount))} TL
                    </td>
                    <td className="py-1.5">
                      {e.paidAt ? (
                        <span className="text-green-700">
                          Ödendi · {fmtTarih(e.paidAt)}
                        </span>
                      ) : (
                        <span className="text-amber-700">Bekliyor</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
