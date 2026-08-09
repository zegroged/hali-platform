import { sadeceSahip } from "@/lib/panelYetki";
import { modulGerekir } from "@/lib/paketYetki";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { PendingButton } from "@/components/PendingButton";
import MoneyInput from "@/components/MoneyInput";
import { mutabakatHesapla, gunAraligi, bugunISO } from "@/lib/tahsilat";
import { nakitTeslimAl, nakitTeslimSil } from "./actions";

export const dynamic = "force-dynamic";

const TZ = "Europe/Istanbul";
const tl = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  " TL";
const saat = (d: Date) =>
  d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const gunAdi = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });

// GÜN SONU TAHSİLAT MUTABAKATI (2026-07-29).
//
// Halıcının her akşam cevaplanması gereken sorusu: "şoför bugün ne topladı,
// kasaya ne girdi?" Bugüne kadar bu soru SORULAMIYORDU çünkü nakit teslimde
// paymentStatus koşulsuz PAID yazılıyordu — sistem her teslimatta "tahsil
// edildi" diyordu.
//
// ⚠️ KASA İLE AYNI ŞEY DEĞİL, ekranda da öyle yazıyor:
//   Kasa      = TAHAKKUK (teslim ettiğin iş, lib/ledger.ts canlı toplar)
//   Mutabakat = NAKİT     (elime ne geçti)
// Buradan Kasa'ya gelir satırı YAZILMAZ; yazılsa aynı para iki kez sayılırdı.
export default async function MutabakatSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ gun?: string; hata?: string; ok?: string }>;
}) {
  // 🔴 SAHİBE ÖZEL SAYFA (2026-08-06). Kapı PRISMA'DAN ÖNCE: App Router'da
  // layout ile page paralel render edilir, layout yönlendirse bile buradaki
  // sorgu çalışır ve veri RSC yükünde sızabilir.
  await sadeceSahip();

  // 🔴 YETKİ PRISMA'DAN ÖNCE: layout'un yönlendirmesine güvenmek YETMEZ —
  // bu depoda RSC verisinin sayfa kaynağından okunabildiği gerçek bir sızıntı
  // yaşandı (bkz. DEVIR, app-router yetki sızıntısı).
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");
  // PAKET KAPISI — sayfanın kendi verisine dokunmadan önce (FIYAT §1-C).
  modulGerekir(b.subscription, "MUTABAKAT");

  const sp = await searchParams;
  const gunISO = /^\d{4}-\d{2}-\d{2}$/.test(sp.gun ?? "")
    ? sp.gun!
    : bugunISO(new Date());
  const { bas, son } = gunAraligi(gunISO);

  const [teslimRows, devirRows, soforler] = await Promise.all([
    prisma.order.findMany({
      where: {
        businessId: b.id, // 🔴 izolasyon
        status: "DELIVERED",
        deliveredAt: { gte: bas, lt: son },
      },
      select: {
        id: true,
        code: true,
        priceTotal: true,
        collectedAmount: true,
        collectedAt: true,
        collectedMethod: true,
        customerName: true,
        driverId: true,
        // Şoför adı User tablosunda tutuluyor — Driver.name YOK.
        driver: { select: { user: { select: { name: true } } } },
      },
      orderBy: { deliveredAt: "asc" },
    }),
    prisma.cashHandover.findMany({
      where: { businessId: b.id, createdAt: { gte: bas, lt: son } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.driver.findMany({
      where: { businessId: b.id },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const ozet = mutabakatHesapla(
    teslimRows.map((o) => ({
      orderId: o.id,
      driverId: o.driverId,
      driverName: o.driver?.user.name ?? null,
      tutar: Number(o.priceTotal ?? 0),
      tahsilEdildi: o.collectedAt != null,
      yontem: o.collectedMethod,
    })),
    devirRows.map((d) => ({ driverId: d.driverId, tutar: Number(d.amount) })),
  );

  const kutu = "rounded-xl border border-slate-200 bg-white";
  const oncekiGun = new Date(bas.getTime() - 12 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const sonrakiGun = new Date(son.getTime() + 12 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const bugun = bugunISO(new Date());

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-16 md:max-w-3xl lg:max-w-5xl">
      <h1 className="mt-4 text-xl font-bold text-slate-900">Gün Sonu Mutabakatı</h1>
      <p className="mt-1 text-sm text-slate-600">
        Şoför bugün ne topladı, kasaya ne girdi, üzerinde ne kaldı.
      </p>

      {sp.ok && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {sp.ok}
        </p>
      )}
      {sp.hata && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.hata}
        </p>
      )}

      {/* Gün gezinme — 2026-07-30: üçü tek satırdaydı ve 360px ekranda ortadaki
          tarih ("30 Temmuz 2026 (bugün)") iki butonu sıkıştırıp "← Önceki gün"ü
          iki satıra kırıyordu. Tarih kendi satırına alındı; butonlar satır
          kırmıyor ve dokunma hedefi büyüdü. */}
      <div className="mt-4 space-y-2">
        <p className="text-center text-sm font-semibold text-slate-800">
          {gunAdi(gunISO)}
          {gunISO === bugun && " (bugün)"}
        </p>
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/panel/mutabakat?gun=${oncekiGun}`}
            className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            ← Önceki gün
          </Link>
          {gunISO < bugun ? (
            <Link
              href={`/panel/mutabakat?gun=${sonrakiGun}`}
              className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Sonraki gün →
            </Link>
          ) : (
            <span className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-300">
              Sonraki gün →
            </span>
          )}
        </div>
      </div>

      {/* KASA İLE FARKI — bu uyarı bilerek duruyor: iki farklı "bu ay ne
          kazandım" rakamı gören halıcı sisteme güvenmeyi bırakır. */}
      <p className={`${kutu} mt-4 p-3 text-xs leading-relaxed text-slate-600`}>
        <strong className="text-slate-800">Kasa ile aynı şey değil.</strong>{" "}
        Kasa <strong>teslim ettiğin işi</strong> gösterir (tahakkuk). Burası{" "}
        <strong>eline geçen parayı</strong> gösterir (nakit). Aradaki fark,
        teslim edip henüz tahsil etmediğin işlerdir — kurumsal müşteri veya
        veresiye. Bu ekran Kasa&apos;ya kayıt YAZMAZ.
      </p>

      {/* Özet şeridi */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Teslimat", String(ozet.toplamTeslimat)],
          ["Tahsilat", tl(ozet.toplamTahsilat)],
          ["Bunun IBAN'a geleni", tl(ozet.toplamIbanTahsilat)],
          ["Tahsil edilmeyen", tl(ozet.toplamTahsilEdilmeyen)],
          ["Şoförlerde bekleyen", tl(ozet.toplamBekleyen)],
        ].map(([etiket, deger], i) => (
          <div key={etiket} className={`${kutu} p-3`}>
            <p className="text-xs text-slate-500">{etiket}</p>
            {/* 2026-07-30 DÜZELTME: indisler kaymıştı. Dizi sırası
                0 Teslimat · 1 Tahsilat · 2 IBAN'a gelen · 3 Tahsil edilmeyen ·
                4 Şoförlerde bekleyen. Kod `i === 3` iken `toplamBekleyen`e
                bakıyordu, yani "Şoförlerde bekleyen" para varken "Tahsil
                edilmeyen" kartı sarıya dönüyordu — para ekranında yanlış kart
                işaretleniyordu. `i === 2` dalının iki ucu da aynı renkti,
                yani hiçbir işe yaramıyordu. */}
            <p
              className={`mt-1 text-lg font-bold ${
                i === 4 && ozet.toplamBekleyen > 0
                  ? "text-amber-700"
                  : i === 3 && ozet.toplamTahsilEdilmeyen > 0
                    ? "text-amber-700"
                    : "text-slate-900"
              }`}
            >
              {deger}
            </p>
          </div>
        ))}
      </div>

      {/* Şoför bazlı tablo */}
      <h2 className="mt-6 font-semibold text-slate-900">Şoför bazlı</h2>
      {ozet.satirlar.length === 0 ? (
        <p className={`${kutu} mt-2 p-4 text-sm text-slate-500`}>
          Bu gün teslim edilmiş sipariş ve nakit teslimi yok.
        </p>
      ) : (
        <div className={`${kutu} mt-2 overflow-x-auto`}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Şoför</th>
                <th className="px-3 py-2 text-right">Teslimat</th>
                <th className="px-3 py-2 text-right">Tahsilat</th>
                <th className="px-3 py-2 text-right">Tahsil edilmeyen</th>
                <th className="px-3 py-2 text-right">Teslim aldığım</th>
                <th className="px-3 py-2 text-right">Üzerinde</th>
              </tr>
            </thead>
            <tbody>
              {ozet.satirlar.map((s) => (
                <tr key={s.driverId ?? "panel"} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {s.driverName}
                  </td>
                  <td className="px-3 py-2 text-right">{s.teslimat}</td>
                  <td className="px-3 py-2 text-right">{tl(s.tahsilat)}</td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {s.tahsilEdilmeyen > 0 ? tl(s.tahsilEdilmeyen) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">{tl(s.devredilen)}</td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      s.bekleyen > 0
                        ? "text-amber-700"
                        : s.bekleyen < 0
                          ? "text-red-600"
                          : "text-emerald-700"
                    }`}
                  >
                    {tl(s.bekleyen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ozet.satirlar.some((s) => s.bekleyen < 0) && (
        <p className="mt-2 text-xs text-red-600">
          Eksi bakiye: o şoförden bugün tahsil ettiğinden fazlasını teslim
          almışsın — dünün parasını bugün getirmiş olabilir.
        </p>
      )}

      {/* Nakit teslim alma */}
      <h2 className="mt-6 font-semibold text-slate-900">Şoförden nakit teslim al</h2>
      <form action={nakitTeslimAl} className={`${kutu} mt-2 grid gap-3 p-4 sm:grid-cols-4`}>
        <div className="sm:col-span-1">
          <label htmlFor="mut-sofor" className="mb-1 block text-xs font-medium text-slate-600">
            Şoför
          </label>
          <select
            id="mut-sofor"
            name="driverId"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand"
          >
            {soforler.map((d) => (
              <option key={d.id} value={d.id}>
                {d.user.name}
              </option>
            ))}
            {soforler.length === 0 && <option value="">Şoför yok</option>}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="mut-tutar" className="mb-1 block text-xs font-medium text-slate-600">
            Tutar (TL)
          </label>
          <MoneyInput
            id="mut-tutar"
            name="amount"
            required
            placeholder="Ör. 6.000"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand"
          />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="mut-not" className="mb-1 block text-xs font-medium text-slate-600">
            Not (isteğe bağlı)
          </label>
          <input
            id="mut-not"
            name="note"
            maxLength={120}
            placeholder="Ör. akşam teslim"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand"
          />
        </div>
        <div className="flex items-end sm:col-span-1">
          <PendingButton className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60">
            Teslim Aldım
          </PendingButton>
        </div>
      </form>

      {devirRows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {devirRows.map((d) => (
            <li
              key={d.id}
              className={`${kutu} flex items-center justify-between gap-3 px-3 py-2 text-sm`}
            >
              <span className="text-slate-700">
                <strong>{d.driverName}</strong> · {tl(Number(d.amount))} ·{" "}
                {saat(d.createdAt)}
                {d.note && <span className="text-slate-500"> · {d.note}</span>}
              </span>
              <form action={nakitTeslimSil}>
                <input type="hidden" name="id" value={d.id} />
                <PendingButton className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                  Sil
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/* Teslim edilen siparişler — tahsil edilmeyenler ayırt edilebilir */}
      <h2 className="mt-6 font-semibold text-slate-900">Bu günün teslimatları</h2>
      {teslimRows.length === 0 ? (
        <p className={`${kutu} mt-2 p-4 text-sm text-slate-500`}>
          Bu gün teslim edilmiş sipariş yok.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {teslimRows.map((o) => (
            <li
              key={o.id}
              className={`${kutu} flex items-center justify-between gap-3 px-3 py-2 text-sm`}
            >
              <Link
                href={`/panel/siparisler/${o.id}`}
                className="font-medium text-brand-dark hover:underline"
              >
                {o.code ?? o.id.slice(-6)} · {o.customerName}
              </Link>
              <span className="flex items-center gap-2">
                <span className="text-slate-700">{tl(Number(o.priceTotal ?? 0))}</span>
                {o.collectedAt ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    tahsil edildi
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                    tahsil edilmedi
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
