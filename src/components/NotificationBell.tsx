"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_ICON: Record<string, string> = {
  "yeni-siparis": "📦",
  "fiyat-onay": "✅",
  "is-atandi": "🚚",
  iptal: "⚠️",
  dogrulama: "🔎",
  genel: "🔔",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}

/**
 * Uygulama-içi bildirim zili (panel + şoför başlığı). ~20 sn'de bir sunucudan
 * okunmamış sayısını + son bildirimleri çeker; açılınca tümünü okundu işaretler.
 * SMS mock olduğundan içerideki kullanıcıya ulaşmanın asıl yolu budur.
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number; items: Item[] };
      setUnread(data.unread);
      setItems(data.items);
    } catch {
      // sessiz geç — sonraki poll'da tekrar denenir
    }
  }, []);

  // İlk yükleme + 20 sn poll. Sekme arka plandayken de çalışır (hafif istek).
  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    // Açılışta hepsini okundu işaretle (rozet sıfırlanır; liste görünür kalır).
    if (next && unread > 0) {
      setUnread(0);
      setItems((prev) =>
        prev.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() })),
      );
      try {
        await fetch("/api/notifications/read", { method: "POST" });
      } catch {
        /* sonraki poll düzeltir */
      }
    }
  }

  function openItem(it: Item) {
    setOpen(false);
    if (it.href) router.push(it.href);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Bildirimler${unread > 0 ? ` (${unread} yeni)` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-800">Bildirimler</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                Henüz bildirim yok.
              </p>
            ) : (
              items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => openItem(it)}
                  className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    it.readAt ? "" : "bg-brand-light/30"
                  }`}
                >
                  <span className="text-lg leading-none">
                    {TYPE_ICON[it.type] ?? "🔔"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800">
                      {it.title}
                    </span>
                    {it.body && (
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {it.body}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {timeAgo(it.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
