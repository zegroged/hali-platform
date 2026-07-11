"use client";

import { useRef, useState } from "react";
import { IconX } from "@/components/icons";

type Photo = { id: string; url: string };

/** Sipariş yönetim sayfası: fotoğraf yükleme + galeri + silme.
 *  Galeri yerel state'te tutulur → yükleme/silme ANINDA görünür; sayfanın
 *  ağır yeniden-render'ını (router.refresh) beklemez. */
export function OrderPhotoManager({
  orderId,
  photos: initialPhotos,
}: {
  orderId: string;
  photos: Photo[];
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const files = fileRef.current?.files;
    if (!files || !files.length) {
      setErr("Önce dosya seç.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("files", f);
      const res = await fetch(`/api/panel/orders/${orderId}/photos`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as {
        photos?: Photo[];
        error?: string;
      } | null;
      if (!res.ok) {
        setErr(data?.error ?? "Yükleme başarısız (jpg/png/webp, ≤5MB).");
        return;
      }
      // Dönen fotoğrafları galeriye anında ekle — sayfa yenilemeye gerek yok.
      if (data?.photos?.length) setPhotos((prev) => [...prev, ...data.photos!]);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setErr("Bağlantı hatası, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(photoId: string) {
    if (!confirm("Fotoğraf silinsin mi?")) return;
    // İyimser: önce ekrandan kaldır, sunucu reddederse geri koy.
    const snapshot = photos;
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    try {
      const res = await fetch(`/api/panel/orders/${orderId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      if (!res.ok) setPhotos(snapshot); // geri al
    } catch {
      setPhotos(snapshot); // bağlantı hatası → geri al
    }
  }

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt="Sipariş fotoğrafı"
                loading="lazy"
                decoding="async"
                className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
              />
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label="Fotoğrafı sil"
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 shadow hover:bg-red-50"
              >
                <IconX size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="flex-1 text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
        />
        <button
          onClick={upload}
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Yükleniyor…" : "Fotoğraf yükle"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Müşteri bu fotoğrafları takip sayfasında görür (jpg/png/webp, ≤5MB,
        sipariş başına en fazla 20).
      </p>
      {err && (
        <p role="alert" className="text-sm text-red-600">
          {err}
        </p>
      )}
    </div>
  );
}
