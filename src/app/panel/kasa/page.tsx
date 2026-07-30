import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { ayOzeti, ayAraligi, KATEGORI_ETIKET } from "@/lib/ledger";
import type { LedgerCategory } from "@prisma/client";
import { PendingButton } from "@/components/PendingButton";
import LedgerEntryForm from "@/components/LedgerEntryForm";
import {
  addLedgerEntry,
  deleteLedgerEntry,
  toggleRecurrence,
  deleteRecurrence,
} from "./actions";

export const dynamic = "force-dynamic";

const tl = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  " TL";
const gun = (d: Date) =>
  d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
const ayAdi = (d: Date) =>
  d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

// KASA: halıcının kendi gelir-gider defteri. Gelir teslim edilen siparişlerden
// OTOMATİK; gider elle. Tekrarlayan kalemler (deterjan/maaş) kendiliğinden düşer.
export default async function KasaSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string; hata?: string; ok?: string }>;
}) {
  const b = await getCurrentBusiness();
  if (!b) return null;
  const { ay, hata, ok } = await searchParams;

  // ?ay=2026-07 — yoksa bu ay.
  const simdi = new Date();
  let yil = simdi.getFullYear();
  let ay0 = simdi.getMonth();
  if (ay && /^\d{4}-\d{2}$/.test(ay)) {
    const [y, m] = ay.split("-").map(Number);
    if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12) {
      yil = y;
      ay0 = m - 1;
    }
  }
  const { bas, son } = ayAraligi(yil, ay0);
  const ozet = await ayOzeti(b.id, yil, ay0);

  const [kayitlar, kurallar, gecmisKategoriler] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { businessId: b.id, date: { gte: bas, lt: son } },
      orderBy: { date: "desc" },
      take: 300,
    }),
    prisma.ledgerRecurrence.findMany({
      where: { businessId: b.id },
      orderBy: { createdAt: "desc" },
    }),
    // Bu işletmenin DAHA ÖNCE yazdığı kategori adları — forma öneri düşer ki
    // aynı şey "Deterjan"/"deterjan" diye ikiye bölünmesin.
    prisma.ledgerEntry.findMany({
      where: { businessId: b.id, categoryLabel: { not: null } },
      distinct: ["categoryLabel"],
      select: { categoryLabel: true },
      orderBy: { date: "desc" },
      take: 40,
    }),
  ]);

  // Öneri listesi: önce halıcının kendi yazdıkları, sonra hazır kalıplar.
  const kategoriOnerileri = Array.from(
    new Set([
      ...gecmisKategoriler.map((g) => g.categoryLabel!).filter(Boolean),
      ...Object.values(KATEGORI_ETIKET),
    ]),
  );

  /** Kalemin ekranda görünecek kategori adı: kendi yazdığı varsa O. */
  const katAdi = (k: { categoryLabel: string | null; category: LedgerCategory }) =>
    k.categoryLabel?.trim() || KATEGORI_ETIKET[k.category];

  const ayLink = (delta: number) => {
    const d = new Date(yil, ay0 + delta, 1);
    return `/panel/kasa?ay=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const bugun = `${simdi.getFullYear()}-${String(simdi.getMonth() + 1).padStart(2, "0")}-${String(simdi.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">
          Kasa — Gelir / Gider
        </h1>
        {/* 2026-07-30: ok butonları ~26×30px idi — erişilebilirlik eşiği 44px
            ve kullanıcı kitlesi 50-65 yaş; ay değiştirmek için nişan almak
            gerekiyordu. 44×44'e çıkarıldı, ekran okuyucu için ad verildi. */}
        <div className="flex items-center gap-1 text-sm">
          <Link
            href={ayLink(-1)}
            aria-label="Önceki ay"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-600 hover:bg-slate-50"
          >
            ‹
          </Link>
          <span className="min-w-[9rem] text-center font-medium text-slate-800">
            {ayAdi(bas)}
          </span>
          <Link
            href={ayLink(1)}
            aria-label="Sonraki ay"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-600 hover:bg-slate-50"
          >
            ›
          </Link>
        </div>
      </div>

      {ok && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Kayıt eklendi.
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

      {/* Özet */}
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Sipariş geliri (otomatik)</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {tl(ozet.siparisGeliri)}
          </p>
          <p className="text-xs text-slate-400">
            {ozet.siparisAdedi} teslim edilen sipariş
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Elle eklenen gelir</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {tl(ozet.elleGelir)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Gider</p>
          <p className="mt-1 text-xl font-bold text-red-600">{tl(ozet.gider)}</p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            ozet.kar >= 0
              ? "border-green-300 bg-green-50"
              : "border-red-300 bg-red-50"
          }`}
        >
          <p className="text-xs text-slate-600">
            {ozet.kar >= 0 ? "Kâr" : "Zarar"}
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              ozet.kar >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {tl(ozet.kar)}
          </p>
          <p className="text-xs text-slate-500">
            {tl(ozet.toplamGelir)} gelir − {tl(ozet.gider)} gider
          </p>
        </div>
      </div>

      {ozet.kategoriler.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-slate-900">
            Gider dağılımı ({ayAdi(bas)})
          </h2>
          <ul className="space-y-2">
            {ozet.kategoriler.map((k) => {
              const yuzde = ozet.gider > 0 ? (k.tutar / ozet.gider) * 100 : 0;
              return (
                <li key={k.kategori}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-700">{k.kategori}</span>
                    <span className="font-medium text-slate-900">
                      {tl(k.tutar)}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        %{yuzde.toFixed(0)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.max(2, yuzde)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* YENİ KALEM FORMU — istemci bileşeni (2026-07-28).
          Sunucu bileşeninde tutulamazdı: gelir/gider seçimine göre etiketlerin
          değişmesi ve tekrar seçeneklerinin birbirini dışlaması durum ister. */}
      <LedgerEntryForm
        action={addLedgerEntry}
        kategoriOnerileri={kategoriOnerileri}
        bugun={bugun}
      />

      {/* Tekrarlayan kurallar */}
      {kurallar.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 font-semibold text-slate-900">
            Tekrarlayan Kalemler
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {kurallar.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  <span className="font-medium text-slate-800">{k.label}</span>{" "}
                  <span className="text-slate-500">
                    · {tl(Number(k.amount))} ·{" "}
                    {k.everyDays
                      ? `her ${k.everyDays} günde`
                      : `her ayın ${k.monthDay}'i`}
                    {k.active ? ` · sonraki: ${gun(k.nextRunAt)}` : " · duraklatıldı"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <form action={toggleRecurrence}>
                    <input type="hidden" name="id" value={k.id} />
                    <PendingButton className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                      {k.active ? "Duraklat" : "Devam ettir"}
                    </PendingButton>
                  </form>
                  <form action={deleteRecurrence}>
                    <input type="hidden" name="id" value={k.id} />
                    <PendingButton className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                      Sil
                    </PendingButton>
                  </form>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Kuralı silmek geçmiş kayıtları silmez — defter geçmişi korunur.
          </p>
        </section>
      )}

      {/* Ayın kayıtları */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">
          {ayAdi(bas)} kayıtları
        </h2>
        {kayitlar.length === 0 ? (
          <p className="text-sm text-slate-500">
            Bu ay elle girilmiş kalem yok. Sipariş gelirleri otomatik sayılır.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5">Tarih</th>
                  <th className="py-1.5">Kalem</th>
                  <th className="py-1.5">Kategori</th>
                  <th className="py-1.5 text-right">Tutar</th>
                  <th className="py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kayitlar.map((k) => (
                  <tr key={k.id}>
                    <td className="py-1.5 whitespace-nowrap">{gun(k.date)}</td>
                    <td className="py-1.5">
                      {k.label}
                      {k.recurrenceId && (
                        <span className="ml-1 text-xs text-slate-400">
                          otomatik
                        </span>
                      )}
                      {k.note && (
                        <span className="block text-xs text-slate-400">
                          {k.note}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-slate-500">
                      {katAdi(k)}
                    </td>
                    <td
                      className={`py-1.5 text-right font-medium ${
                        k.kind === "INCOME" ? "text-green-700" : "text-slate-900"
                      }`}
                    >
                      {k.kind === "INCOME" ? "+" : "−"}
                      {tl(Number(k.amount))}
                    </td>
                    <td className="py-1.5 text-right">
                      <form action={deleteLedgerEntry}>
                        <input type="hidden" name="id" value={k.id} />
                        <PendingButton className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">
                          Sil
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

      <p className="text-xs text-slate-400">
        Not: Gelir, <strong>teslim edilmiş</strong> ve fiyatı girilmiş
        siparişlerden otomatik hesaplanır. Bu defter senin kendi işletme
        muhasebendir; platform aboneliği ve resmî faturalarla ilgisi yoktur.
      </p>
    </div>
  );
}
