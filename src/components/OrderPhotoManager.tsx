"use client";

import { useRef, useState } from "react";
import {
  OrderPhotoGallery,
  type GalleryPhoto,
} from "@/components/OrderPhotoGallery";
import type { PhotoStage } from "@/lib/photoStage";

/** Sipariş yönetim sayfası: fotoğraf yükleme + galeri + silme.
 *  Galeri yerel state'te tutulur → yükleme/silme ANINDA görünür; sayfanın
 *  ağır yeniden-render'ını (router.refresh) beklemez.
 *
 *  `uploadStage` verilirse yüklenen fotoğraflar o aşamaya bağlanır (bugün
 *  yalnız "YIKAMA" — alım/teslim fotoğrafı şoför akışında zorunlu olarak
 *  çekiliyor). Müşteri takip sayfası bu etiketi aynen gösterir. */
export function OrderPhotoManager({
  orderId,
  photos: initialPhotos,
  uploadStage,
}: {
  orderId: string;
  photos: GalleryPhoto[];
  uploadStage?: PhotoStage;
}) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const yikama = uploadStage === "YIKAMA";

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
      if (uploadStage) fd.append("stage", uploadStage);
      const res = await fetch(`/api/panel/orders/${orderId}/photos`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as {
        photos?: GalleryPhoto[];
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
    setErr(null);
    try {
      const res = await fetch(`/api/panel/orders/${orderId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      if (!res.ok) {
        setPhotos(snapshot); // geri al
        // Kanıt fotoğrafı silinemez (409) — sebebi söylenmezse halıcı fotoğrafın
        // geri gelmesini hata sanıyordu.
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setErr(data?.error ?? "Fotoğraf silinemedi.");
      }
    } catch {
      setPhotos(snapshot); // bağlantı hatası → geri al
      setErr("Bağlantı hatası, lütfen tekrar deneyin.");
    }
  }

  return (
    <div className="space-y-3">
      <OrderPhotoGallery photos={photos} onRemove={remove} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          aria-label={yikama ? "Yıkama fotoğrafı seç" : "Fotoğraf seç"}
          className="min-w-0 flex-1 text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
        />
        <button
          onClick={upload}
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {loading
            ? "Yükleniyor…"
            : yikama
              ? "Yıkama fotoğrafı ekle"
              : "Fotoğraf yükle"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {yikama
          ? "Yıkama sırasında çektiğin kareler müşterinin takip sayfasında “Yıkama” etiketiyle görünür — birden fazla ekleyebilirsin (jpg/png/webp, ≤5MB, sipariş başına en fazla 20)."
          : "Müşteri bu fotoğrafları takip sayfasında görür (jpg/png/webp, ≤5MB, sipariş başına en fazla 20)."}
      </p>
      {err && (
        <p role="alert" className="text-sm text-red-600">
          {err}
        </p>
      )}
    </div>
  );
}
