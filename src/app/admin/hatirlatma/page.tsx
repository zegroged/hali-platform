import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import {
  getSezonAyar,
  getSonCalisma,
  sezonOnizleme,
} from "@/lib/seasonReminder";
import { whatsappEnabled } from "@/lib/whatsapp";
import { PendingButton } from "@/components/PendingButton";
import { sezonAyarKaydet, sezonElleTetikle } from "./actions";

// SEZON HATIRLATMASI YÖNETİMİ (2026-07-30) — işletme sahibi kararı:
// "sadece admin paneline adapte et, admin kararı ile 6 ayda bir yollansın".
// Halıcı bu ekranı GÖRMEZ; /panel/hatirlatma silindi.

export const dynamic = "force-dynamic";

const TZ = "Europe/Istanbul";
const fmt = (d: Date) =>
  d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });

/** 05321112233 → 0532 *** ** 33 — önizleme listesi KVKK'ya takılmasın. */
function telMaske(p: string): string {
  if (!/^0\d{10}$/.test(p)) return "***";
  return `${p.slice(0, 4)} *** ** ${p.slice(9)}`;
}

export default async function SezonHatirlatmaSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  // 🔴 YETKİ PRISMA'DAN ÖNCE (App Router RSC sızıntısı dersi).
  const u = await getSessionUser();
  if (!u || u.role !== "ADMIN") redirect("/giris");

  const sp = await searchParams;
  const [ayar, son] = await Promise.all([getSezonAyar(), getSonCalisma()]);
  // Önizleme, GERÇEK gönderimle AYNI fonksiyondan gelir — ekranda görünen
  // sayı ile gönderilecek sayı ayrışamaz.
  const on = await sezonOnizleme(ayar.ay);

  const kutu = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">
          Sezon Hatırlatması
        </h1>
        <Link href="/admin" className="text-sm text-brand-dark hover:underline">
          ← Admin paneli
        </Link>
      </div>

      {sp.ok && (
        <p className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {sp.ok}
        </p>
      )}
      {sp.hata && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {sp.hata}
        </p>
      )}

      <p className="text-sm text-slate-600">
        Uzun süredir hizmet almamış müşterilere, en son çalıştıkları işletmenin
        adıyla &quot;halılarınızın bakım zamanı&quot; mesajı gider. Kanal:{" "}
        {whatsappEnabled
          ? "WhatsApp (şablon onaylıysa), gitmezse e-posta"
          : "e-posta (WhatsApp kapalı)"}
        . Aynı müşteriye bir daha yazılmaz.
      </p>

      {/* Ayarlar */}
      <section className={kutu}>
        <h2 className="font-semibold text-slate-900">Ayarlar</h2>
        <form action={sezonAyarKaydet} className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="acik"
              value="1"
              defaultChecked={ayar.acik}
              className="h-5 w-5 rounded border-slate-300 accent-brand"
            />
            <span>
              <strong>Otomatik gönderim açık</strong> — her gün denetlenir,
              süresi dolan müşteriye kendiliğinden yazılır
            </span>
          </label>
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">
              Kaç ay sonra hatırlatılsın?
            </span>
            <input
              type="number"
              name="ay"
              min={1}
              max={24}
              defaultValue={ayar.ay}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand"
            />
          </label>
          <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60">
            Kaydet
          </PendingButton>
        </form>
      </section>

      {/* Durum */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={kutu}>
          <p className="text-xs text-slate-500">Durum</p>
          <p
            className={`mt-1 text-lg font-bold ${ayar.acik ? "text-green-700" : "text-slate-900"}`}
          >
            {ayar.acik ? "Açık" : "Kapalı"}
          </p>
          <p className="text-xs text-slate-500">{ayar.ay} ay eşiği</p>
        </div>
        <div className={kutu}>
          <p className="text-xs text-slate-500">Şu an sırada</p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {on.satirlar.length}
            {on.pencereDoldu ? "+" : ""} müşteri
          </p>
          {on.atlanan > 0 && (
            <p className="text-xs text-slate-500">
              {on.atlanan} müşteri atlandı (işletmesi yayında değil)
            </p>
          )}
          {on.pencereDoldu && (
            <p className="text-xs text-amber-700">
              Tarama penceresi doldu — gerçek sayı daha yüksek olabilir; turlar
              halinde gönderilir.
            </p>
          )}
        </div>
        <div className={kutu}>
          <p className="text-xs text-slate-500">Son çalışma</p>
          {son ? (
            <>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {fmt(new Date(son.at))}
              </p>
              <p className="text-xs text-slate-500">
                {son.gonderilen} gönderildi (WhatsApp {son.kanal.whatsapp} ·
                e-posta {son.kanal.eposta}){son.elle ? " · elle" : ""}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Henüz hiç çalışmadı.</p>
          )}
        </div>
      </div>

      {/* Elle tetikleme */}
      <section className={kutu}>
        <h2 className="font-semibold text-slate-900">Elle gönder</h2>
        <p className="mt-1 text-sm text-slate-500">
          Anahtar kapalıyken de çalışır — yukarıdaki listedeki müşterilere ŞİMDİ
          gönderir (tur başına en fazla 100). Bu bir ticari iletidir; İYS/izin
          tarafının tamam olduğundan emin ol.
        </p>
        <form action={sezonElleTetikle} className="mt-3">
          <PendingButton className="rounded-lg border border-amber-400 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60">
            {on.satirlar.length > 0
              ? `${Math.min(on.satirlar.length, 100)} müşteriye şimdi gönder`
              : "Gönderilecek müşteri yok"}
          </PendingButton>
        </form>
      </section>

      {/* Önizleme listesi */}
      <section className={kutu}>
        <h2 className="font-semibold text-slate-900">
          Sıradaki müşteriler{" "}
          <span className="text-sm font-normal text-slate-500">
            (ilk 20 gösteriliyor)
          </span>
        </h2>
        {on.satirlar.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            {ayar.ay} ayı dolan, hatırlatılmamış müşteri yok.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {/* key'de TAM telefon KULLANMA: React key'i RSC yukune yazilir,
                sayfa kaynaginda maskesiz numara gorunurdu (denetim bulgusu). */}
            {on.satirlar.slice(0, 20).map((s, i) => (
              <li
                key={`${i}-${s.sonTeslim.getTime()}`}
                className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-slate-800">
                  {s.name}{" "}
                  <span className="text-slate-500">{telMaske(s.phone)}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {s.businessName} · son teslim {fmt(s.sonTeslim).slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
