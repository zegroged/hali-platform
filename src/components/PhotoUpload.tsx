"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function PhotoUpload() {
  const router = useRouter();
  const [kind, setKind] = useState<"after" | "before">("after");
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
    const fd = new FormData();
    fd.append("kind", kind);
    for (const f of Array.from(files)) fd.append("files", f);
    const res = await fetch("/api/panel/upload", { method: "POST", body: fd });
    setLoading(false);
    if (res.ok) {
      if (fileRef.current) fileRef.current.value = "";
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
          onChange={(e) => setKind(e.target.value as "after" | "before")}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="after">Sonrası</option>
          <option value="before">Öncesi</option>
        </select>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="flex-1 text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
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
        İstediğin kadar seçebilirsin (jpg/png/webp, her biri ≤5MB).
      </p>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
