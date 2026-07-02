"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PhoneVerify({ phone }: { phone: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "sent">("idle");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function request() {
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/panel/phone/request", { method: "POST" });
    setLoading(false);
    if (res.ok) {
      const d = await res.json();
      setDevCode(d.devCode ?? null);
      setStage("sent");
    } else {
      setErr("Kod gönderilemedi.");
    }
  }

  async function confirm() {
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/panel/phone/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
    else setErr("Kod hatalı veya süresi dolmuş.");
  }

  const inp = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  if (stage === "idle") {
    return (
      <div>
        <button
          onClick={request}
          disabled={loading}
          className="rounded-lg border border-brand px-3 py-1.5 text-sm font-medium text-brand-dark disabled:opacity-60"
        >
          {loading ? "Gönderiliyor…" : `📱 ${phone} doğrula`}
        </button>
        {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {devCode && (
        <p className="text-xs text-slate-400">
          Demo kod (mock SMS): <b className="text-slate-700">{devCode}</b>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6 haneli kod"
          inputMode="numeric"
          className={inp}
        />
        <button
          onClick={confirm}
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Onayla
        </button>
        <button
          onClick={request}
          disabled={loading}
          className="text-sm text-slate-400"
        >
          Tekrar gönder
        </button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
