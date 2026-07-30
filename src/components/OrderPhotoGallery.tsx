"use client";

import { IconX } from "@/components/icons";
import { photoStageLabel, photoStageRank } from "@/lib/photoStage";

export type GalleryPhoto = {
  id: string;
  url: string;
  stage?: string | null;
  createdAt?: string | null;
};

/**
 * Sipariş fotoğrafı galerisi — AYNI bileşen hem müşteri takip sayfasında hem
 * halıcı panelinde kullanılır (iki ayrı galeri iki ayrı gerçek üretmesin).
 *
 * Sıralama: aşama akışı (Alım → Yıkama → Teslim → etiketsiz), her aşamanın
 * içinde zaman sırası. Müşteri halısının yolculuğunu bu sırayla okur.
 *
 * `onRemove` verilirse silme düğmesi çıkar (yalnız panel) — müşteri tarafında
 * verilmez, yani takip sayfasından fotoğraf silinemez.
 */
export function OrderPhotoGallery({
  photos,
  onRemove,
}: {
  photos: GalleryPhoto[];
  onRemove?: (photoId: string) => void;
}) {
  if (photos.length === 0) return null;

  const sirali = [...photos].sort((a, b) => {
    const r = photoStageRank(a.stage) - photoStageRank(b.stage);
    if (r !== 0) return r;
    return zaman(a.createdAt) - zaman(b.createdAt);
  });

  // Aşama başlıklarını yalnız aşama DEĞİŞTİĞİNDE yaz — grid akışı bölünmesin
  // diye başlık ayrı bir tam-genişlik satırı olur.
  const bloklar: { key: string; label: string | null; items: GalleryPhoto[] }[] = [];
  for (const p of sirali) {
    const label = photoStageLabel(p.stage);
    const son = bloklar[bloklar.length - 1];
    if (son && son.label === label) son.items.push(p);
    else bloklar.push({ key: `${label ?? "yok"}-${p.id}`, label, items: [p] });
  }

  return (
    <div className="space-y-3">
      {bloklar.map((blok) => (
        <div key={blok.key}>
          <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full bg-brand-light px-2 py-0.5 text-brand-dark">
              {blok.label ?? "Diğer"}
            </span>
            {blok.items[0].createdAt && (
              <span className="font-normal text-slate-400">
                {tarih(blok.items[0].createdAt)}
              </span>
            )}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {blok.items.map((p) => (
              <div key={p.id} className="group relative">
                <a href={p.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={
                      blok.label
                        ? `${blok.label} fotoğrafı`
                        : "Sipariş fotoğrafı"
                    }
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                  />
                </a>
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    aria-label="Fotoğrafı sil"
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 shadow hover:bg-red-50"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function zaman(v: string | null | undefined): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// Konteynerde TZ yok (UTC) — saat dilimi verilmezse saatler 3 saat geri görünür.
function tarih(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}
