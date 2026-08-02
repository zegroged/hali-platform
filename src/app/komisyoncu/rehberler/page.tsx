import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import RehberListesi from "@/components/RehberListesi";
import { rehberleriListele } from "@/lib/rehberler";
import { komisyoncuKimligi } from "./yetki";

export const metadata: Metadata = {
  title: "Rehberler",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

// REHBERLER — komisyoncunun el kitapları (2026-08-02).
// Baş komisyoncu dördünü de görür; alt komisyoncuya BAŞ rehberi kapalıdır
// (havuz matematiği). Süzme sunucuda, rehberleriListele içinde.
export default async function RehberlerSayfasi() {
  const kimlik = await komisyoncuKimligi();
  if (!kimlik) redirect("/giris");

  const rehberler = rehberleriListele(kimlik.isHead);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <Link
        href="/komisyoncu"
        className="text-sm font-medium text-brand-dark hover:underline"
      >
        ← Panele dön
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">📚 Rehberler</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sistemin kullanımı ve satış rehberleri. Ekranda okuyabilir ya da{" "}
          <strong>HTML olarak indirip</strong> telefonuna kaydedebilirsin —
          indirdiğin dosya internet olmadan da açılır.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <RehberListesi rehberler={rehberler} basKomisyoncu={kimlik.isHead} />

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">
            Hepsi tek dosyada
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            {rehberler.length} rehberin tamamı içindekiler listesiyle tek HTML
            dosyasında — telefonda saklamak ve yazdırmak için pratiktir.
          </p>
          <a
            href="/komisyoncu/rehberler/tumu/indir"
            download
            className="mt-2 inline-block rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-white"
          >
            ⬇ Tümünü tek dosya indir
          </a>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Bu rehberler <strong>iç kullanım içindir</strong>; halıcıya ya da
          dışarıya dağıtma. İndirdiğin dosya o günkü metni içerir — güncel
          sürüm her zaman bu sayfadadır.
        </p>
      </section>
    </div>
  );
}
