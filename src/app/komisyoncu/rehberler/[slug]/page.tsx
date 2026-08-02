import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  REHBER_ICERIK_CSS,
  rehberBul,
  rehberGovdesi,
} from "@/lib/rehberler";
import { komisyoncuKimligi } from "../yetki";

export const metadata: Metadata = {
  title: "Rehber",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

// REHBER OKUMA EKRANI (2026-08-02).
// İçerik derleme anında gömülü markdown'dan üretilir (src/lib/rehberIcerik.ts);
// çalışma anında dosya sistemine dokunulmaz. Yetki kapısı içerikten ÖNCE.
export default async function RehberSayfasi({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const kimlik = await komisyoncuKimligi();
  if (!kimlik) redirect("/giris");

  const { slug } = await params;
  // Yetkisi olmayan slug (alt komisyoncuda BAŞ rehberi) ya da olmayan slug:
  // LİSTEYE geri gönderilir.
  // ⚠️ Neden notFound() DEĞİL (2026-08-02 canlı doğrulamada görüldü): bu segment
  // loading.tsx ile stream ediliyor, yanıt başlıkları notFound()'dan ÖNCE
  // gidiyor → tarayıcıya HTTP 200 + "Sayfa bulunamadı" gövdesi düşüyordu.
  // İçerik sızmıyordu ama hem durum kodu yanıltıcıydı hem de kullanıcı çıkmaz
  // sayfada kalıyordu. redirect ikisini de çözer.
  const rehber = rehberBul(slug, kimlik.isHead);
  if (!rehber) redirect("/komisyoncu/rehberler");

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <style dangerouslySetInnerHTML={{ __html: REHBER_ICERIK_CSS }} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/komisyoncu/rehberler"
          className="text-sm font-medium text-brand-dark hover:underline"
        >
          ← Rehberler
        </Link>
        <a
          href={`/komisyoncu/rehberler/${rehber.slug}/indir`}
          download
          className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ⬇ HTML indir
        </a>
      </div>

      {rehber.yalnizBas && (
        <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          Bu rehber <strong>yalnız baş komisyonculara</strong> açıktır — havuz
          payı matematiğini içerir, ekibinle paylaşma.
        </p>
      )}

      <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        {/* İçerik derleme anında bizim .md dosyalarımızdan üretilir; kullanıcı
            girdisi değildir ve çevirici her şeyi HTML kaçışından geçirir. */}
        <div
          className="rehber"
          dangerouslySetInnerHTML={{ __html: rehberGovdesi(rehber) }}
        />
      </article>

      <p className="text-xs text-slate-500">
        İç kullanım içindir — halıcıya ya da dışarıya dağıtma.
      </p>
    </div>
  );
}
