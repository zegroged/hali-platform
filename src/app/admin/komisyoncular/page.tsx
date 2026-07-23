import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createAgent,
  toggleAgentActive,
  toggleAgentDiscount,
  toggleCommissionPaid,
} from "../actions";
import { PendingButton } from "@/components/PendingButton";

export const dynamic = "force-dynamic";

const fmtTL = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTarih = (d: Date) =>
  d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Komisyoncu yönetimi (YALNIZ admin): hesap aç (yüzde + kod), getirdiği
// işletmeleri ve tahakkukları gör, ödendi işaretle, pasife al.
export default async function AdminAgents({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string; ok?: string }>;
}) {
  // Yetki kapısı prisma'dan ÖNCE (RSC sızıntısı önlemi).
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") redirect("/giris");
  const { hata, ok } = await searchParams;

  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, username: true, phone: true } },
      referrals: {
        select: {
          id: true,
          name: true,
          city: true,
          subscription: { select: { status: true, currentPeriodEnd: true } },
        },
      },
    },
  });

  // TOPLAMLAR pencereden DEĞİL veritabanı aggregate'inden (inceleme bulgusu:
  // take'li listeden reduce, eski ödenmemiş borcu görünmez yapıyordu).
  const toplamGrup = await prisma.commissionEntry.groupBy({
    by: ["agentId"],
    _sum: { amount: true },
  });
  const bekleyenGrup = await prisma.commissionEntry.groupBy({
    by: ["agentId"],
    where: { paidAt: null },
    _sum: { amount: true },
  });
  const toplamMap = new Map(toplamGrup.map((t) => [t.agentId, Number(t._sum.amount ?? 0)]));
  const bekleyenMap = new Map(bekleyenGrup.map((t) => [t.agentId, Number(t._sum.amount ?? 0)]));

  // Kayıt tablosu: TÜM ödenmemişler (borç asla pencere dışına düşmesin —
  // "Ödendi işaretle" her zaman erişilebilir) + son 90 günün ödenmişleri.
  const doksanGun = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const tumKayitlar = await prisma.commissionEntry.findMany({
    where: { OR: [{ paidAt: null }, { createdAt: { gte: doksanGun } }] },
    orderBy: { createdAt: "desc" },
    include: { business: { select: { name: true } } },
  });
  const kayitMap = new Map<string, typeof tumKayitlar>();
  for (const k of tumKayitlar) {
    const dizi = kayitMap.get(k.agentId) ?? [];
    dizi.push(k);
    kayitMap.set(k.agentId, dizi);
  }

  const inp =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
  const lbl = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/admin"
        className="text-sm font-medium text-brand-dark hover:underline"
      >
        ← Panele dön
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Komisyoncular</h1>
        <p className="mt-1 text-sm text-slate-500">
          Komisyoncu, kendi panelinden ürettiği TEK KULLANIMLIK kodlarla getirdiği her işletmenin <strong>her abonelik
          ödemesinden</strong> (yenileme dahil), hesap açılırken belirlediğin
          yüzde kadar — <strong>KDV hariç net tutar üzerinden</strong> — pay
          alır. Abonelik yenilenmezse tahakkuk durur. Komisyoncu yalnız{" "}
          <strong>/komisyoncu</strong> sayfasını görür.
        </p>
      </div>

      {ok && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Komisyoncu oluşturuldu: <strong>{ok}</strong>. Kullanıcı adı ve şifreyi
          kendisine iletin; girişten sonra her müşteri için kendi panelinden
          tek kullanımlık kod üretir.
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

      {/* Yeni komisyoncu */}
      <form
        action={createAgent}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h2 className="font-semibold text-slate-900">+ Yeni Komisyoncu</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Ad Soyad</label>
            <input name="name" required className={inp} />
          </div>
          <div>
            <label className={lbl}>Telefon</label>
            <input name="phone" required placeholder="05xxxxxxxxx" className={inp} />
          </div>
          <div>
            <label className={lbl}>Kullanıcı adı</label>
            <input name="username" required className={inp} />
          </div>
          <div>
            <label className={lbl}>Şifre (en az 8)</label>
            <input name="password" required minLength={8} className={inp} />
          </div>
          <div>
            <label className={lbl}>Komisyon yüzdesi (KDV hariç net üzerinden)</label>
            <input
              name="percent"
              required
              inputMode="decimal"
              placeholder="Örn. 50"
              className={inp}
            />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="canDiscount" className="mt-0.5" />
          <span>
            <strong>Premium yetki:</strong> kod üretirken istediği yüzdede
            indirim tanımlayıp süresini istediği kadar (ay) uzatabilir — kodla
            kaydolan işletme o süre boyunca aboneliği indirimli öder.
          </span>
        </label>
        <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
          Komisyoncu Oluştur
        </PendingButton>
      </form>

      {/* Mevcutlar */}
      {agents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
          Henüz komisyoncu yok.
        </p>
      ) : (
        agents.map((a) => {
          const toplam = toplamMap.get(a.id) ?? 0;
          const bekleyen = bekleyenMap.get(a.id) ?? 0;
          const kayitlar = kayitMap.get(a.id) ?? [];
          return (
            <section
              key={a.id}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">
                    {a.user.name}{" "}
                    <span className="text-sm text-slate-500">%{Number(a.percent)}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.user.username} · {a.user.phone}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.canDiscount && (
                    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                      Premium (indirim yetkili)
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      a.active
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {a.active ? "Aktif" : "Pasif"}
                  </span>
                  <form action={toggleAgentDiscount}>
                    <input type="hidden" name="id" value={a.id} />
                    <PendingButton className="rounded-lg border border-violet-300 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50">
                      {a.canDiscount ? "Premium'u kaldır" : "Premium yap"}
                    </PendingButton>
                  </form>
                  <form action={toggleAgentActive}>
                    <input type="hidden" name="id" value={a.id} />
                    <PendingButton className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      {a.active ? "Pasife al" : "Aktive et"}
                    </PendingButton>
                  </form>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-lg font-bold text-slate-900">
                    {a.referrals.length}
                  </div>
                  <div className="text-xs text-slate-500">İşletme</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-lg font-bold text-slate-900">
                    {fmtTL(toplam)} TL
                  </div>
                  <div className="text-xs text-slate-500">Toplam tahakkuk</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-lg font-bold text-amber-700">
                    {fmtTL(bekleyen)} TL
                  </div>
                  <div className="text-xs text-slate-500">Ödenmemiş</div>
                </div>
              </div>

              {a.referrals.length > 0 && (
                <div className="text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Getirdiği: </span>
                  {a.referrals.map((b, i) => (
                    <span key={b.id}>
                      {i > 0 && " · "}
                      <Link
                        href={`/admin/isletme/${b.id}`}
                        className="text-brand-dark hover:underline"
                      >
                        {b.name}
                      </Link>{" "}
                      <span className="text-xs text-slate-400">({b.city})</span>
                    </span>
                  ))}
                </div>
              )}

              {kayitlar.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="py-1.5">Tarih</th>
                        <th className="py-1.5">İşletme</th>
                        <th className="py-1.5">Net</th>
                        <th className="py-1.5">%</th>
                        <th className="py-1.5">Komisyon</th>
                        <th className="py-1.5">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kayitlar.map((e) => (
                        <tr key={e.id}>
                          <td className="py-1.5">{fmtTarih(e.createdAt)}</td>
                          <td className="py-1.5">{e.business.name}</td>
                          <td className="py-1.5">{fmtTL(Number(e.netAmount))} TL</td>
                          <td className="py-1.5">%{Number(e.percent)}</td>
                          <td className="py-1.5 font-medium">
                            {fmtTL(Number(e.amount))} TL
                          </td>
                          <td className="py-1.5">
                            <form action={toggleCommissionPaid}>
                              <input type="hidden" name="id" value={e.id} />
                              <PendingButton
                                className={`rounded px-2 py-0.5 text-xs font-medium ${
                                  e.paidAt
                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                    : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                }`}
                              >
                                {e.paidAt ? `Ödendi ${fmtTarih(e.paidAt)}` : "Ödendi işaretle"}
                              </PendingButton>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
