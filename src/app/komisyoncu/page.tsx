import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscriptionActive } from "@/lib/subscription";
import {
  generateReferralCode,
  createSubAgent,
  toggleSubAgentActive,
  savePayoutInfo,
  requestPayout,
} from "./actions";
import { agentBalance } from "@/lib/payout";
import { PendingButton } from "@/components/PendingButton";

export const dynamic = "force-dynamic";

const fmtTL = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTarih = (d: Date) =>
  d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

// Komisyoncu ekranı (YALNIZ AGENT rolü): kendi kodu, getirdiği işletmeler ve
// komisyon tahakkukları — salt-okunur. Admin/panele giremez.
export default async function KomisyoncuSayfasi({
  searchParams,
}: {
  searchParams: Promise<{
    yeni?: string;
    hata?: string;
    yeniKomisyoncu?: string;
    talep?: string;
    odemeBilgisi?: string;
  }>;
}) {
  const { yeni, hata, yeniKomisyoncu, talep, odemeBilgisi } = await searchParams;
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
      // BAŞ KOMİSYONCU: ekipten gelen havuz farkı kayıtları (son 30).
      headEntries: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          createdAt: true,
          headPercent: true,
          headAmount: true,
          headPaidAt: true,
          business: { select: { name: true } },
          agent: { select: { user: { select: { name: true } } } },
        },
      },
      // BAŞ KOMİSYONCU: kendi açtığı komisyoncular (2 kademe).
      children: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          percent: true,
          active: true,
          createdAt: true,
          user: { select: { name: true, username: true, phone: true } },
          _count: { select: { referrals: true } },
        },
      },
    },
  });
  if (!agent) redirect("/giris");

  // Baş komisyoncu ek toplamları: alt ağaçtan gelen HAVUZ FARKI kazancı.
  const [headToplamAgg, headOdenenAgg] = agent.isHead
    ? await Promise.all([
        prisma.commissionEntry.aggregate({
          where: { headAgentId: agent.id, skipped: false },
          _sum: { headAmount: true },
        }),
        prisma.commissionEntry.aggregate({
          where: { headAgentId: agent.id, skipped: false, headPaidAt: { not: null } },
          _sum: { headAmount: true },
        }),
      ])
    : [null, null];
  const headToplam = Number(headToplamAgg?._sum.headAmount ?? 0);
  const headOdenen = Number(headOdenenAgg?._sum.headAmount ?? 0);
  const havuz = Number(agent.poolPercent ?? 0);
  // Panel örneği havuza göre (sabit %25 küçük havuzlarda imkânsız örnek veriyordu).
  const ornek = Math.max(1, Math.round((havuz / 2) * 100) / 100);

  // ÖDEME (çekim) durumu: bakiye + bekleyen/son talepler.
  const [bakiye, talepler] = await Promise.all([
    agentBalance(agent.id),
    prisma.payoutRequest.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);
  const bekleyenTalep = talepler.find((t) => t.status === "PENDING");

  // Toplamlar take:60 penceresinden DEĞİL aggregate'ten (inceleme bulgusu).
  const [toplamAgg, odenenAgg] = await Promise.all([
    prisma.commissionEntry.aggregate({
      where: { agentId: agent.id, skipped: false },
      _sum: { amount: true },
    }),
    prisma.commissionEntry.aggregate({
      where: { agentId: agent.id, skipped: false, paidAt: { not: null } },
      _sum: { amount: true },
    }),
  ]);
  const toplam = Number(toplamAgg._sum.amount ?? 0);
  const odenen = Number(odenenAgg._sum.amount ?? 0);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          {agent.isHead ? "Baş Komisyoncu Paneli" : "Komisyoncu Paneli"} — {u.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Komisyon oranın: <strong>%{Number(agent.percent)}</strong> (KDV hariç
          net abonelik tutarı üzerinden). <strong>Her müşteri için aşağıdan
          TEK KULLANIMLIK kod üret</strong> — kod bir işletmeye bağlanınca
          yanar; işletmenin aboneliği yenilendikçe komisyonun işlemeye devam
          eder.
        </p>
        {agent.isHead && (
          <p className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <strong>Havuz payın: %{havuz}.</strong> Kendi kodunla getirdiğin
            işletmeden bu oranın tamamını alırsın. Açtığın komisyoncuya
            verdiğin yüzde havuzdan düşer, <strong>kalan fark sana</strong> yazılır
            — örnek: komisyoncuya %{ornek} verdiysen, onun getirdiği her
            işletmenin her ödemesinde %{ornek} ona, %
            {Math.max(0, Number((havuz - ornek).toFixed(2)))} sana. Havuzun
            tamamını (%{havuz}) verirsen o komisyoncudan pay almazsın.
            <br />
            <strong>Dikkat:</strong> Bir komisyoncuyu pasife alırsan yalnız
            KOMİSYON durur — o komisyoncunun getirdiği işletmelerin aboneliği,
            yayını ve siparişleri hiç etkilenmez, ödemeye devam ederler. Pasif
            dönem için ne ona ne sana pay yazılır; sonradan aktive edersen o
            dönem geri gelmez, yeni ödemelerden itibaren işler.
          </p>
        )}
      </div>

      {yeni && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Yeni kodun hazır:{" "}
          <span className="font-mono text-base font-bold">{yeni}</span> — bu
          kodu müşterine ver; kayıt sırasında girecek (tek kullanımlık).
        </p>
      )}
      {yeniKomisyoncu && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Komisyoncu açıldı: <strong>{yeniKomisyoncu}</strong>. Kullanıcı adı ve
          şifresini kendisine ilet — girdikten sonra kendi panelinden müşteri
          başına tek kullanımlık kod üretir.
        </p>
      )}
      {talep && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Ödeme talebin iletildi — yönetim havaleyi yapıp &quot;Ödendi&quot;
          işaretleyince burada göreceksin.
        </p>
      )}
      {odemeBilgisi && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Ödeme bilgilerin kaydedildi.
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

      {/* ÖDEME / ÇEKİM — bakiye, IBAN, aylık otomatik gün, talep butonu */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Ödemem</h2>
          <p className="text-sm text-slate-500">
            Ödenmemiş bakiye:{" "}
            <strong className="text-slate-900">{fmtTL(bakiye.toplam)} TL</strong>
            {agent.isHead && bakiye.havuz > 0 && (
              <span className="text-xs text-slate-400">
                {" "}
                (kendi {fmtTL(bakiye.kendi)} + ekip {fmtTL(bakiye.havuz)})
              </span>
            )}
          </p>
        </div>

        {bekleyenTalep ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>{fmtTL(Number(bekleyenTalep.amount))} TL</strong> için ödeme
            talebin {fmtTarih(bekleyenTalep.createdAt)} tarihinde oluşturuldu ve
            yönetimde bekliyor{bekleyenTalep.auto ? " (aylık otomatik)" : ""}.
          </p>
        ) : (
          <form action={requestPayout} className="mt-3">
            <PendingButton
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              disabled={bakiye.toplam <= 0 || !agent.iban}
            >
              Ödememi talep et ({fmtTL(bakiye.toplam)} TL)
            </PendingButton>
            {!agent.iban && (
              <span className="ml-2 text-xs text-amber-700">
                Önce IBAN kaydet.
              </span>
            )}
          </form>
        )}

        <form
          action={savePayoutInfo}
          className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              IBAN (havale buraya yapılır)
            </label>
            <input
              name="iban"
              defaultValue={agent.iban ?? ""}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              className={inp}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Her ayın kaçında otomatik talep? (1-28, boş = kapalı)
            </label>
            <input
              name="payoutDay"
              inputMode="numeric"
              defaultValue={agent.payoutDay ?? ""}
              placeholder="Örn. 5"
              className={inp}
            />
          </div>
          <div className="sm:col-span-2">
            <PendingButton className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white">
              Ödeme bilgilerini kaydet
            </PendingButton>
            <p className="mt-2 text-xs text-slate-500">
              Otomatik gün seçersen o gün bakiyen varsa talep kendiliğinden
              oluşur — her ay hatırlatmaya gerek kalmaz. Havaleyi yönetim elle
              yapar.
            </p>
          </div>
        </form>

        {talepler.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {talepler.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span>
                  {fmtTarih(t.createdAt)} ·{" "}
                  <strong>{fmtTL(Number(t.amount))} TL</strong>
                  {t.auto && (
                    <span className="ml-1 text-xs text-slate-400">otomatik</span>
                  )}
                </span>
                <span
                  className={`text-xs font-medium ${
                    t.status === "PAID"
                      ? "text-green-700"
                      : t.status === "REJECTED"
                        ? "text-red-600"
                        : "text-amber-700"
                  }`}
                >
                  {t.status === "PAID"
                    ? `Ödendi${t.paidAt ? " · " + fmtTarih(t.paidAt) : ""}`
                    : t.status === "REJECTED"
                      ? `Reddedildi${t.adminNote ? " · " + t.adminNote : ""}`
                      : "Bekliyor"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Referans Kodların</h2>
            <p className="text-sm text-slate-500">
              Her müşteri için ayrı kod üret — aynı kod ikinci kez kullanılamaz.
            </p>
          </div>
          <form
            action={generateReferralCode}
            className="flex flex-wrap items-end gap-2"
          >
            {agent.canDiscount && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    İndirim % (ops.)
                  </label>
                  <input
                    name="discountPercent"
                    inputMode="decimal"
                    placeholder="Örn. 25"
                    className="w-24 rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Süre (ay)
                  </label>
                  <input
                    name="discountMonths"
                    inputMode="numeric"
                    placeholder="Örn. 3"
                    className="w-20 rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
              </>
            )}
            <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
              + Kod Üret
            </PendingButton>
          </form>
        </div>
        {agent.canDiscount && (
          <p className="mt-2 text-xs text-slate-500">
            <strong>Premium yetkin var:</strong> istersen koda indirim göm —
            kodla kaydolan işletme, seçtiğin süre boyunca aboneliği o yüzde
            indirimli öder (komisyonun da indirimli tutar üzerinden hesaplanır).
            Boş bırakırsan kod indirimsiz olur.
          </p>
        )}
        {agent.codes.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {agent.codes.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-2 py-2">
                <span className="font-mono font-semibold text-slate-800">
                  {k.code}
                  {Number(k.discountPercent ?? 0) > 0 && (
                    <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 font-sans text-xs font-medium text-violet-700">
                      %{Number(k.discountPercent).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} indirim · {k.discountMonths} ay
                    </span>
                  )}
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
          <div className="text-xl font-bold text-slate-900">
            {fmtTL(toplam + headToplam)} TL
          </div>
          <div className="text-xs text-slate-500">
            {agent.isHead ? "Toplam kazanç (kendi + ekip)" : "Toplam komisyon"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xl font-bold text-green-700">
            {fmtTL(odenen + headOdenen)} TL
          </div>
          <div className="text-xs text-slate-500">Ödenen</div>
        </div>
      </div>

      {agent.isHead && (
        <section className="rounded-2xl border border-indigo-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Komisyoncularım</h2>
            <p className="text-sm text-slate-500">
              Ekipten kazancın:{" "}
              <strong className="text-slate-800">{fmtTL(headToplam)} TL</strong>{" "}
              (ödenen {fmtTL(headOdenen)} TL)
            </p>
          </div>

          {agent.children.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Henüz komisyoncu açmadın. Aşağıdaki formla hesap aç, yüzdesini sen
              belirle.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {agent.children.map((k) => (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    <span className="font-medium text-slate-800">
                      {k.user.name}
                    </span>{" "}
                    <span className="text-xs text-slate-400">
                      {k.user.username} · {k.user.phone}
                    </span>
                    <br />
                    <span className="text-xs text-slate-500">
                      %{Number(k.percent)} komisyoncuya · %
                      {Math.max(0, Number((havuz - Number(k.percent)).toFixed(2)))}{" "}
                      sana · {k._count.referrals} işletme getirdi
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        k.active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {k.active ? "Aktif" : "Pasif"}
                    </span>
                    <form action={toggleSubAgentActive}>
                      <input type="hidden" name="id" value={k.id} />
                      <PendingButton className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                        {k.active ? "Pasife al" : "Aktive et"}
                      </PendingButton>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {agent.headEntries.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Ekipten Kazançların{" "}
                <span className="text-xs font-normal text-slate-400">
                  (son 30)
                </span>
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-1.5">Tarih</th>
                    <th className="py-1.5">İşletme</th>
                    <th className="py-1.5">Komisyoncu</th>
                    <th className="py-1.5">Payın</th>
                    <th className="py-1.5">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agent.headEntries.map((e) => (
                    <tr key={e.id}>
                      <td className="py-1.5">{fmtTarih(e.createdAt)}</td>
                      <td className="py-1.5">{e.business.name}</td>
                      <td className="py-1.5 text-slate-500">
                        {e.agent.user.name}
                      </td>
                      <td className="py-1.5 font-medium">
                        {fmtTL(Number(e.headAmount ?? 0))} TL
                        <span className="ml-1 text-xs text-slate-400">
                          (%{Number(e.headPercent ?? 0)})
                        </span>
                      </td>
                      <td className="py-1.5">
                        {e.headPaidAt ? (
                          <span className="text-green-700">
                            Ödendi · {fmtTarih(e.headPaidAt)}
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

          {/* Yeni komisyoncu — yüzdeyi baş komisyoncu belirler (0..havuz) */}
          <form
            action={createSubAgent}
            className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <h3 className="text-sm font-semibold text-slate-900">
              + Yeni Komisyoncu Aç
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Ad Soyad
                </label>
                <input name="name" required className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Telefon
                </label>
                <input
                  name="phone"
                  required
                  placeholder="05xxxxxxxxx"
                  className={inp}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Kullanıcı adı
                </label>
                <input name="username" required className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Şifre (en az 8)
                </label>
                <input name="password" required minLength={8} className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Komisyon yüzdesi (en fazla %{havuz})
                </label>
                <input
                  name="percent"
                  required
                  inputMode="decimal"
                  placeholder={`Örn. ${Math.floor(havuz / 2)}`}
                  className={inp}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Verdiğin yüzde havuz payından düşer, kalanı sana yazılır. Bu hesap
              kendi altına komisyoncu açamaz ve indirim tanımlayamaz.
            </p>
            <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
              Komisyoncu Oluştur
            </PendingButton>
          </form>
        </section>
      )}

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
