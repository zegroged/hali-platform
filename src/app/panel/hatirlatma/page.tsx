import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import {
  sezonAy,
  sezonEsigi,
  seasonReminderEnabled,
  telefonaGoreGrupla,
} from "@/lib/seasonReminder";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const TZ = "Europe/Istanbul";
const tl = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  " TL";
// Konteynerde TZ yok (UTC) — timeZone verilmezse tarihler 3 saat geri kayar.
const gun = (d: Date) =>
  d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });
const ayAdi = (d: Date) =>
  d.toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: TZ });

/** Bir TR ayının UTC yarım-açık aralığı — TR günü 00:00 = UTC 21:00 (önceki gün). */
function ayAraligiTR(yil: number, ay1: number): { bas: Date; son: Date } {
  const UC_SAAT = 3 * 60 * 60 * 1000;
  return {
    bas: new Date(Date.UTC(yil, ay1 - 1, 1) - UC_SAAT),
    son: new Date(Date.UTC(yil, ay1, 1) - UC_SAAT),
  };
}

// SEZON HATIRLATMASI — HALICININ EKRANI (2026-07-30).
//
// Otomatik e-posta tek başına yetmez: halıcı KİMİN arandığını görmeli. Görmezse
// aynı müşteriyi bir de kendisi arar (ya da hiç aramaz) ve sisteme güvenmez.
// Ayrıca e-postası olmayan müşteriler yalnız BURADA görünür — onlara ancak
// halıcı telefonla dönebilir.
export default async function HatirlatmaSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  // 🔴 YETKİ PRISMA'DAN ÖNCE: layout yönlendirmesine güvenmek YETMEZ — bu
  // depoda RSC verisinin sayfa kaynağından okunabildiği gerçek bir sızıntı
  // yaşandı (bkz. app-router yetki sızıntısı).
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");

  const sp = await searchParams;
  const simdi = new Date();
  const esik = sezonEsigi(simdi);

  // İKİ KİP:
  //  - varsayılan: "sezonu gelenler" (son hizmeti N aydan eski olanlar)
  //  - ?ay=YYYY-MM: o ay hizmet verilenler (geçmişe bakmak için)
  let pencere: { bas: Date; son: Date } | null = null;
  let secilenAy: { yil: number; ay: number } | null = null;
  if (/^\d{4}-\d{2}$/.test(sp.ay ?? "")) {
    const [y, a] = sp.ay!.split("-").map(Number);
    if (y >= 2020 && y <= 2100 && a >= 1 && a <= 12) {
      secilenAy = { yil: y, ay: a };
      pencere = ayAraligiTR(y, a);
    }
  }

  const [teslimler, yakinTeslimler] = await Promise.all([
    prisma.order.findMany({
      where: {
        businessId: b.id, // 🔴 İŞLETME İZOLASYONU — oturumdan gelen kimlik
        status: "DELIVERED",
        deliveredAt: pencere
          ? { gte: pencere.bas, lt: pencere.son }
          : { lte: esik },
      },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        deliveredAt: true,
        priceTotal: true,
        seasonRemindedAt: true,
        customer: { select: { email: true } },
      },
      orderBy: { deliveredAt: "desc" },
      take: 500,
    }),
    // Sezonu gelenler kipinde: yakın zamanda yeniden hizmet almış numaraları
    // ele. Zaten gelen müşteriye "uzun zamandır görüşmedik" demek yanlış.
    pencere
      ? Promise.resolve([])
      : prisma.order.findMany({
          where: {
            businessId: b.id,
            status: "DELIVERED",
            deliveredAt: { gt: esik },
          },
          select: { customerPhone: true },
          take: 2000,
        }),
  ]);

  const yakinSet = new Set(
    yakinTeslimler.map((o) => normalizePhone(o.customerPhone)).filter(Boolean),
  );

  const satirlar = telefonaGoreGrupla(
    teslimler
      .filter((o) => o.deliveredAt != null)
      .map((o) => ({
        orderId: o.id,
        phone: o.customerPhone,
        name: o.customerName,
        email: o.customerEmail ?? o.customer?.email ?? null,
        deliveredAt: o.deliveredAt!,
        tutar: Number(o.priceTotal ?? 0),
        businessId: b.id,
        businessName: b.name,
        remindedAt: o.seasonRemindedAt,
      })),
  ).filter((s) => pencere != null || !yakinSet.has(s.phone));

  const epostasiz = satirlar.filter((s) => !s.email).length;
  const yazilan = satirlar.filter((s) => s.remindedAt).length;

  // Ay gezinme: ay seçilmemişse "N ay önce bu ay"dan başlar (asıl merak edilen
  // ay o). Eşiği TR'ye kaydır: ay başı gecelerinde UTC ayı bir geri gösterir.
  const esikTR = new Date(esik.getTime() + 3 * 60 * 60 * 1000);
  const bakilanAy =
    secilenAy ??
    { yil: esikTR.getUTCFullYear(), ay: esikTR.getUTCMonth() + 1 };
  // Gün 15 + öğlen: ay kaydırmasında saat dilimi/ay sonu taşması olmasın.
  const bakilanAyTarihi = new Date(
    Date.UTC(bakilanAy.yil, bakilanAy.ay - 1, 15, 12),
  );
  const ayLink = (delta: number) => {
    const d = new Date(Date.UTC(bakilanAy.yil, bakilanAy.ay - 1 + delta, 15, 12));
    return `/panel/hatirlatma?ay=${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const kutu = "rounded-xl border border-slate-200 bg-white";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Sezon Hatırlatması
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {pencere
            ? `${ayAdi(bakilanAyTarihi)} ayında hizmet verdiğin müşteriler.`
            : `Son hizmetinin üzerinden ${sezonAy} aydan fazla geçen müşteriler — halının bakım zamanı.`}
        </p>
      </div>

      {/* Bayrak durumu: halıcı otomatik mailin gidip gitmediğini BİLMELİ.
          Kapalıyken "sistem hallediyor" sanıp hiç aramaması en kötü senaryo. */}
      <p
        className={`rounded-xl border px-4 py-3 text-sm ${
          seasonReminderEnabled
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : "border-amber-300 bg-amber-50 text-amber-800"
        }`}
      >
        {seasonReminderEnabled ? (
          <>
            <strong>Otomatik hatırlatma açık.</strong> E-posta adresi olan
            müşterilere {sezonAy} ay sonunda kendiliğinden yazılır. Listedeki
            &quot;yazıldı&quot; işareti bunu gösterir.
          </>
        ) : (
          <>
            <strong>Otomatik hatırlatma şu an kapalı.</strong> Bu liste hazır —
            müşterilerini buradan görüp arayabilirsin. Otomatik e-posta
            gönderimi izin süreçleri tamamlanınca açılacak.
          </>
        )}
      </p>

      {/* Kip / ay gezinme */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/panel/hatirlatma"
          aria-current={pencere ? undefined : "page"}
          className={`rounded-lg border px-3 py-1.5 text-sm ${
            pencere
              ? "border-slate-300 text-slate-600 hover:bg-slate-50"
              : "border-brand bg-brand-light font-semibold text-brand-dark"
          }`}
        >
          Sezonu gelenler
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link
            href={ayLink(-1)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"
          >
            ‹
          </Link>
          <span className="min-w-[9rem] text-center font-medium text-slate-800">
            {ayAdi(bakilanAyTarihi)}
          </span>
          <Link
            href={ayLink(1)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"
          >
            ›
          </Link>
        </div>
      </div>

      {/* Özet şeridi */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`${kutu} p-3`}>
          <p className="text-xs text-slate-500">Müşteri</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {satirlar.length}
          </p>
        </div>
        <div className={`${kutu} p-3`}>
          <p className="text-xs text-slate-500">Hatırlatma yazıldı</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{yazilan}</p>
        </div>
        <div className={`${kutu} p-3`}>
          <p className="text-xs text-slate-500">E-postası yok (ara)</p>
          <p className="mt-1 text-xl font-bold text-amber-700">{epostasiz}</p>
        </div>
      </div>

      {satirlar.length === 0 ? (
        <p className={`${kutu} p-4 text-sm text-slate-500`}>
          {pencere
            ? "Bu ay teslim edilmiş sipariş yok."
            : `Şu an ${sezonAy} aydan eski müşterin görünmüyor.`}
        </p>
      ) : (
        <div className={`${kutu} overflow-x-auto`}>
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Müşteri</th>
                <th className="px-3 py-2">Telefon</th>
                <th className="px-3 py-2">Son hizmet</th>
                <th className="px-3 py-2 text-right">Sipariş</th>
                <th className="px-3 py-2 text-right">Toplam</th>
                <th className="px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s) => (
                <tr key={s.phone} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {s.name}
                  </td>
                  <td className="px-3 py-2">
                    {/* Telefon bağlantısı: halıcının işi zaten "aramak". */}
                    <a
                      href={`tel:${s.phone}`}
                      className="text-brand-dark hover:underline"
                    >
                      {s.phone}
                    </a>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                    {gun(s.sonTeslim)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {s.siparisSayisi}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {tl(s.toplamTutar)}
                  </td>
                  <td className="px-3 py-2">
                    {s.remindedAt ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs whitespace-nowrap text-emerald-700">
                        yazıldı · {gun(s.remindedAt)}
                      </span>
                    ) : s.email ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs whitespace-nowrap text-slate-600">
                        sırada
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs whitespace-nowrap text-amber-700">
                        e-postası yok — ara
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Aynı numaranın birden fazla siparişi tek satırda toplanır — bir müşteriye
        bir kez yazılır. Son {sezonAy} ay içinde yeniden hizmet alan müşteriler
        bu listede çıkmaz.
      </p>
    </div>
  );
}
