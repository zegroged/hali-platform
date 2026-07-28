import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bolgeHaritasi } from "@/lib/territory";
import { CITIES, districtsOfCity } from "@/lib/cities";
import BolgeHaritasi from "@/components/BolgeHaritasi";

export const dynamic = "force-dynamic";

// BÖLGE HARİTASI — KOMİSYONCU TARAFI (2026-07-28).
//
// YETKİ AYRIMI (kullanıcı kararı):
// - BAŞ komisyoncu: ülke genelini görür (ekibini nereye yönlendireceğine
//   karar verebilmesi için).
// - ALT komisyoncu: YALNIZ kendi ilini görür. Ülke geneli rekabet bilgisidir,
//   alt kademeye açılmaz.
//
// Yetki kapısı sayfanın kendisinde (layout'a güvenilmez — RSC veri sızıntısı).
export default async function KomisyoncuBolgelerPage() {
  const u = await getSessionUser();
  if (!u || u.role !== "AGENT") redirect("/giris");

  const agent = await prisma.agent.findUnique({
    where: { userId: u.id },
    select: {
      id: true,
      isHead: true,
      territories: { select: { city: true, district: true } },
    },
  });
  if (!agent) redirect("/giris");

  // Alt komisyoncunun ili: atanmış bölgelerinden ilki.
  const kendiIl = agent.territories[0]?.city ?? null;
  const kendiIlceler = agent.territories.map((t) => t.district);

  // ⚠️ SORGU BAŞTAN DARALTILIYOR (2026-07-28 denetim bulgusu — YÜKSEK):
  // eskiden alt komisyoncu için de ülke geneli çekilip yalnız `iller` dizisi
  // filtreleniyordu; `ilceler` sözlüğü FİLTRESİZ prop olarak gidiyordu.
  // BolgeHaritasi bir istemci bileşeni olduğu için bu veri RSC yüküyle
  // tarayıcıya iniyor ve sayfa kaynağından okunabiliyordu — yani alt komisyoncu
  // ülkenin tamamının komisyoncu/işletme dağılımını görebiliyordu. Ekranda
  // gizlemek yetmez, VERİYİ GÖNDERMEMEK gerekir.
  const { iller, ilceler } = await bolgeHaritasi(
    agent.isHead ? undefined : (kendiIl ?? "__yok__"),
  );
  const ilceAdlari: Record<string, string[]> = {};
  const gorunurIller = agent.isHead ? CITIES : CITIES.filter((c) => c.name === kendiIl);
  for (const c of gorunurIller) ilceAdlari[c.name] = [...districtsOfCity(c.name)];

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 lg:max-w-5xl">
      <Link
        href="/komisyoncu"
        className="text-sm font-medium text-brand-dark hover:underline"
      >
        ← Panele dön
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Bölge Haritası</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          {agent.isHead
            ? "Hangi ilçede kaç komisyoncu çalışıyor, kaç işletme kayıtlı. Ekibini boş bölgelere yönlendirebilirsin."
            : "Bölgendeki durum: hangi ilçede kaç komisyoncu var, kaç işletme kayıtlı."}
        </p>
      </div>

      {agent.territories.length > 0 && (
        <div className="rounded-xl border border-brand bg-brand-light/40 p-3">
          <p className="text-xs font-medium text-brand-dark">Senin bölgen</p>
          <p className="mt-0.5 text-sm text-slate-700">
            {kendiIl} — {kendiIlceler.join(", ")}
          </p>
        </div>
      )}

      {agent.isHead ? (
        <BolgeHaritasi
          iller={iller}
          ilceler={Object.fromEntries(ilceler)}
          ilceAdlari={ilceAdlari}
        />
      ) : kendiIl ? (
        <BolgeHaritasi
          iller={iller}
          ilceler={Object.fromEntries(ilceler)}
          ilceAdlari={ilceAdlari}
          tekIl={kendiIl}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Sana henüz bir bölge atanmamış. Baş komisyoncun ya da yönetim
          atadığında burada görünecek.
        </p>
      )}
    </div>
  );
}
