import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { bolgeHaritasi } from "@/lib/territory";
import { CITIES, districtsOfCity } from "@/lib/cities";
import BolgeHaritasi from "@/components/BolgeHaritasi";

export const dynamic = "force-dynamic";

// BÖLGE HARİTASI — ADMIN (2026-07-28).
// Yetki kapısı sayfanın KENDİSİNDE (layout redirect'ine güvenilmez — RSC veri
// sızıntısı riski, bkz. DEVIR "App Router yetki sızıntısı").
export default async function AdminBolgelerPage() {
  const u = await getSessionUser();
  if (!u || u.role !== "ADMIN") redirect("/giris");

  const { iller, ilceler, konumsuzIsletme } = await bolgeHaritasi();
  const ilceAdlari: Record<string, string[]> = {};
  for (const c of CITIES) ilceAdlari[c.name] = [...districtsOfCity(c.name)];

  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm font-medium text-brand-dark hover:underline">
        ← Yönetime dön
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Bölge Haritası</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Hangi ilçede kaç komisyoncu çalışıyor, kaç işletme kayıtlı. Boşta olan
          bölgeleri buradan görüp komisyoncu yönlendirebilirsin.
        </p>
      </div>

      {konumsuzIsletme > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{konumsuzIsletme} işletmenin</strong> il/ilçesi tanımsız — aşağıdaki
          sayımlara <strong>girmiyorlar</strong>. Konumsuz kayıt sitede hiçbir yerde
          listelenmez; admin panelinden il/ilçelerini tamamlaman gerekir.
        </p>
      )}
      <BolgeHaritasi
        iller={iller}
        ilceler={Object.fromEntries(ilceler)}
        ilceAdlari={ilceAdlari}
      />

      <p className="text-xs text-slate-500">
        Not: aynı ilçeye birden fazla komisyoncu atanabilir — sistem engellemez,
        atama sırasında yalnız uyarır. Sayımlarda pasif ve dondurulmuş
        komisyoncular gösterilmez.
      </p>
    </div>
  );
}
