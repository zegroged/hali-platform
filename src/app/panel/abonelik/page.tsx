import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { subscriptionActive } from "@/lib/subscription";
import { recurringEnabled, paymentsLive } from "@/lib/config";
import { effectiveSubscriptionGross } from "@/lib/discount";
import { PendingButton } from "@/components/PendingButton";
import {
  startSubscriptionPayment,
  cancelRecurringSubscription,
} from "../subscription-actions";

export const dynamic = "force-dynamic";

const tr = (d: Date) =>
  new Date(d).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const tl = (v: unknown) =>
  Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL";

const DURUM: Record<string, { cls: string; text: string }> = {
  basladi: {
    cls: "border-green-300 bg-green-50 text-green-800",
    text: "Aboneliğin başladı — düzenli ödeme talimatın aktif. Her ay otomatik yenilenir.",
  },
  "iptal-ok": {
    cls: "border-green-300 bg-green-50 text-green-800",
    text: "Otomatik yenileme iptal edildi. Mevcut dönem sonuna kadar yayında kalırsın; sonrasında yenilenmez.",
  },
  "iptal-hata": {
    cls: "border-red-300 bg-red-50 text-red-700",
    text: "İptal sırasında bir sorun oldu. Tekrar dene veya bize ulaş.",
  },
  "talimat-zaten-var": {
    cls: "border-amber-300 bg-amber-50 text-amber-800",
    text: "Zaten aktif bir otomatik ödeme talimatın var — ikinci talimat açılmadı (açılsaydı kartından her ay İKİ KEZ çekilirdi). Değiştirmek istiyorsan önce mevcut talimatı iptal et, sonra yenisini aç.",
  },
  "talimat-yok": {
    cls: "border-amber-300 bg-amber-50 text-amber-800",
    text: "Aktif bir otomatik ödeme talimatın yok.",
  },
  // Komisyoncunun tanıtım hesabı: aboneliği ücretsiz ve süresizdir, ödeme
  // akışına hiç girmez (bkz. lib/demoPanel.ts).
  demo: {
    cls: "border-violet-300 bg-violet-50 text-violet-800",
    text: "Bu bir DEMO panelidir — aboneliği ücretsiz ve süresizdir, ödeme alınmaz.",
  },
  "hazir-degil": {
    cls: "border-amber-300 bg-amber-50 text-amber-800",
    text: "Otomatik ödeme henüz aktif değil; şimdilik ödeme onay sürecinde alınır.",
  },
  hata: {
    cls: "border-red-300 bg-red-50 text-red-700",
    text: "Ödeme tamamlanamadı. Tekrar deneyebilirsin.",
  },
  ucretsiz: {
    cls: "border-green-300 bg-green-50 text-green-800",
    text: "%100 indirimin sayesinde dönemin ÜCRETSİZ tanımlandı. 🎉 (Yayında görünmek için profil şartlarının da tamam olması gerekir.)",
  },
  "ucretsiz-erken": {
    cls: "border-amber-300 bg-amber-50 text-amber-800",
    text: "Dönemin zaten aktif — ücretsiz yenileme, dönem sonuna 3 gün kala açılabilir.",
  },
  "indirimli-erken": {
    cls: "border-amber-300 bg-amber-50 text-amber-800",
    text: "Dönemin zaten aktif — indirimli yenileme, dönem sonuna 3 gün kala açılabilir.",
  },
  "indirimli-talimat-yok": {
    cls: "border-amber-300 bg-amber-50 text-amber-800",
    text: "İndirimin sürerken otomatik ödeme talimatı verilemez (talimat indirimsiz tam tutardan işler). İndirimin bitince buradan açabilirsin — o zamana kadar her dönem indirimli ödersin.",
  },
};

export default async function AbonelikYonetim({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const b = await getCurrentBusiness();
  if (!b) return null;
  const { durum } = await searchParams;
  const banner = durum ? DURUM[durum] : undefined;

  const sub = b.subscription;
  const active = subscriptionActive(sub);
  const autoRenew = Boolean(sub?.autoRenew && sub?.iyzicoSubRef);
  // Geçerli indirim (premium komisyoncu kodu ya da yönetim): tahsilat bu
  // tutardan yapılır; 0 = dönem ücretsiz açılır. İndirimliyken erken yenileme
  // yasak (aksiyon reddeder) — butonu da aynı kuralla gizleriz.
  const { gross, pct } = effectiveSubscriptionGross(b);
  const indirimliErkenYasak =
    pct != null &&
    (sub?.currentPeriodEnd?.getTime() ?? 0) > Date.now() + 3 * 24 * 60 * 60 * 1000;

  const history = await prisma.subscriptionPayment.findMany({
    where: { businessId: b.id },
    orderBy: { createdAt: "desc" },
    take: 24,
  });

  return (
    <div className="space-y-6">
      <Link href="/panel" className="text-sm font-medium text-brand-dark hover:underline">
        ← Panele dön
      </Link>
      <h1 className="text-lg font-semibold text-slate-900">Abonelik</h1>

      {banner && (
        <p className={`rounded-xl border px-4 py-3 text-sm ${banner.cls}`}>
          {banner.text}
        </p>
      )}

      {/* Durum kartı */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">İşletme Aboneliği</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              ₺2.000{" "}
              <span className="text-sm font-medium text-slate-500">
                + KDV / ay
              </span>
            </p>
            {pct != null && b.discountUntil && (
              <p className="mt-1 inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                %{pct.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}{" "}
                indirim — {tr(b.discountUntil)} tarihine kadar
                {gross > 0 ? ` (aylık ${tl(gross)})` : " (ücretsiz)"}
              </p>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              active
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {active ? "Aktif" : "Pasif"}
          </span>
        </div>
        <dl className="mt-4 space-y-1.5 text-sm">
          {b.billingCode && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Cari (abone) kodu</dt>
              <dd className="font-mono text-slate-800">{b.billingCode}</dd>
            </div>
          )}
          {sub?.currentPeriodEnd && (
            <div className="flex justify-between">
              <dt className="text-slate-500">
                {autoRenew ? "Sonraki yenileme" : "Dönem sonu"}
              </dt>
              <dd className="font-medium text-slate-900">
                {tr(sub.currentPeriodEnd)}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-500">Otomatik yenileme</dt>
            <dd className="font-medium text-slate-900">
              {autoRenew
                ? "Açık (her ay otomatik)"
                : sub?.canceledAt
                  ? "İptal edildi"
                  : "Kapalı"}
            </dd>
          </div>
        </dl>

        {/* Aksiyon: aktif talimat varsa iptal; yoksa başlat/öde */}
        <div className="mt-5">
          {autoRenew ? (
            /* "Otomatik yenilemeyi iptal et" halıcıya soyut geliyordu; ama düz
               "Aboneliği iptal et" de YANILTICI — buton dönemi bitirmiyor,
               yalnız bir sonraki çekimi durduruyor. Sade başlık + altında ne
               olacağı TARİHİYLE yazıldı (2026-07-27 kullanıcı geri bildirimi). */
            <div>
              <form action={cancelRecurringSubscription}>
                <PendingButton className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50">
                  Aboneliği iptal et
                </PendingButton>
              </form>
              <p className="mt-2 text-xs text-slate-500">
                Paran yanmaz:{" "}
                {sub?.currentPeriodEnd ? (
                  <>
                    <strong>{tr(sub.currentPeriodEnd)}</strong> tarihine kadar
                    yayında kalırsın
                  </>
                ) : (
                  <>ödediğin dönem sonuna kadar yayında kalırsın</>
                )}
                , o tarihten sonra yenilenmez ve kartından bir daha çekim yapılmaz.
              </p>
            </div>
          ) : recurringEnabled && pct == null ? (
            // İKİ YOL BİRDEN (2026-07-25): talimat yalnız KREDİ kartıyla verilebiliyor
            // (iyzico abonelik NON3D → banka kartı reddi, hata 10217). Talimat açıkken
            // tek çekim butonu gizlenince banka kartlı halıcı bu sayfada hiçbir ödeme
            // yolu göremiyordu — ikisi birlikte sunulur.
            <div className="space-y-3">
              {/* <a> BİLEREK (Link değil): iyzico form script'i ancak TAM SAYFA
                  yüklemesinde çalışır; client-side geçişte kart formu boş kalıyordu. */}
              <a
                href="/odeme/abonelik"
                className="inline-flex rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
              >
                Otomatik yenile — düzenli ödeme talimatı (kredi kartı)
              </a>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-600">
                  <strong>Banka (debit) kartın mı var?</strong> Düzenli ödeme
                  talimatı kredi kartı ister — bankalar banka kartında 3D Secure
                  şart koşuyor, abonelik çekimleri ise 3D Secure&apos;suz yapılır.
                  Banka kartıyla aşağıdan <strong>tek seferlik</strong> ödeyip her
                  ay bu sayfadan yenileyebilirsin (dönem sonundan 3 gün önce
                  hatırlatma e-postası göndeririz).
                </p>
                <form action={startSubscriptionPayment} className="mt-2">
                  <PendingButton className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-light">
                    Tek seferlik öde — {tl(gross)} (banka kartı da geçer)
                  </PendingButton>
                </form>
              </div>
            </div>
          ) : paymentsLive ? (
            indirimliErkenYasak ? (
              <p className="text-sm text-amber-700">
                Dönemin aktif — indirimli yenileme, dönem sonuna 3 gün kala bu
                sayfadan açılır.
              </p>
            ) : (
              <form action={startSubscriptionPayment}>
                <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
                  {gross <= 0
                    ? "Dönemini ücretsiz başlat (%100 indirim)"
                    : pct != null
                      ? `Aboneliğini öde — ${tl(gross)} (indirimli, iyzico ile)`
                      : "Aboneliğini öde — 2.400 TL (iyzico ile)"}
                </PendingButton>
              </form>
            )
          ) : (
            <p className="text-sm text-amber-700">
              Online ödeme yakında; şu an ödeme onay sürecinde havale/EFT ile
              alınır. Ödemen doğrulanınca hesabın yayına girer.
            </p>
          )}
        </div>

        {/* Düzenli ödeme talimatı bilgilendirmesi (yasal) */}
        {recurringEnabled && !autoRenew && (
          <p className="mt-3 text-xs text-slate-500">
            <strong>Düzenli ödeme talimatı:</strong> Kartın iyzico&apos;nun
            güvenli sistemine bir kez kaydedilir; <strong>iptal edene kadar
            her ay 2.400 TL (KDV dahil)</strong> otomatik çekilir. İstediğin
            zaman bu sayfadan iptal edebilirsin; iptalde mevcut dönem sonuna
            kadar yayında kalırsın.
          </p>
        )}
      </section>

      {/* Ödeme geçmişi */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Ödeme Geçmişi</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz ödeme kaydın yok.</p>
        ) : (
          <div className="no-scrollbar overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2">Tarih</th>
                  <th className="py-2">Tutar</th>
                  <th className="py-2">Durum</th>
                  <th className="py-2">Dönem</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-700">
                      {tr(p.paidAt ?? p.createdAt)}
                    </td>
                    <td className="py-2 text-slate-900">{tl(p.amount)}</td>
                    <td className="py-2">
                      <span
                        className={
                          p.status === "PAID"
                            ? "text-green-600"
                            : p.status === "FAILED"
                              ? "text-red-600"
                              : "text-slate-500"
                        }
                      >
                        {p.status === "PAID"
                          ? "Ödendi"
                          : p.status === "FAILED"
                            ? "Başarısız"
                            : "Bekliyor"}
                      </span>
                    </td>
                    <td className="py-2 text-slate-500">
                      {p.periodEnd ? tr(p.periodEnd) : "—"}
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
