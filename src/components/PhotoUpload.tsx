"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function PhotoUpload() {
  const router = useRouter();
  const [kind, setKind] = useState<"after" | "before" | "genel" | "logo">(
    "after",
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uyari, setUyari] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const files = fileRef.current?.files;
    if (!files || !files.length) {
      setErr("Önce dosya seç.");
      return;
    }
    setLoading(true);
    setErr(null);
    setUyari(null);
    const fd = new FormData();
    fd.append("kind", kind);
    for (const f of Array.from(files)) fd.append("files", f);
    const res = await fetch("/api/panel/upload", { method: "POST", body: fd });
    setLoading(false);
    if (res.ok) {
      if (fileRef.current) fileRef.current.value = "";
      // DÜŞÜK ÇÖZÜNÜRLÜK UYARISI (2026-08-03): yüklenen kare kartta gerilip
      // bulanıklaşacaksa halıcı bunu ÖĞRENSİN. Yükleme başarılı sayılır,
      // yalnız uyarı basılır — fotoğrafı reddetmek profili boş bırakırdı.
      const veri = await res.json().catch(() => null);
      const kucuk: string[] = veri?.kucukGorseller ?? [];
      setUyari(
        kucuk.length
          ? `Yüklendi ama ${kucuk.length} fotoğraf küçük (${kucuk.join(", ")}). Vitrinde bulanık görünür — telefonla YATAY ve aydınlık bir kare çekip yeniden yükle.`
          : null,
      );
      router.refresh();
    } else {
      setErr("Yükleme başarısız (jpg/png/webp, ≤5MB).");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={kind}
          onChange={(e) =>
            setKind(e.target.value as "after" | "before" | "genel" | "logo")
          }
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="genel">İşletme fotoğrafı</option>
          <option value="after">Sonrası</option>
          <option value="before">Öncesi</option>
          <option value="logo">Logo</option>
        </select>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={kind !== "logo"}
          className="min-w-0 flex-1 text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
        />
      </div>
      <button
        onClick={upload}
        disabled={loading}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {loading ? "Yükleniyor…" : "Fotoğrafları yükle"}
      </button>
      <p className="text-xs text-slate-400">
        Aynı kategoriye istediğin kadar fotoğraf biriktirebilirsin: dosya
        seçerken Ctrl ile çoklu seç, dilersen üst üste tekrar yükle — yeni
        yükleme öncekileri SİLMEZ, ekler (jpg/png/webp, her biri ≤5MB). Logo
        tek dosyadır; yenisi eskisinin yerine geçer.
      </p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {uyari && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ⚠️ {uyari}
        </p>
      )}
    </div>
  );
}
