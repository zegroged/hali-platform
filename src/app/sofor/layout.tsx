import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, demoBiletiVarMi } from "@/lib/auth";
import { demodanDon } from "@/app/komisyoncu/demo-actions";
import { PendingButton } from "@/components/PendingButton";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";

// Şoför sayfaları arama motorlarına kapalı.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SoforLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await getSessionUser();
  if (!u || u.role !== "DRIVER") redirect("/giris");

  // DEMO ŞERİDİ — /panel'deki ikizi (2026-08-02): komisyoncu tek tıkla demo
  // şoför ekranına geçtiyse buradan kendi paneline döner.
  const demodaMi = await demoBiletiVarMi();

  return (
    <div className="min-h-screen bg-slate-50">
      {demodaMi && (
        <div className="sticky top-0 z-30 bg-violet-600 px-4 py-2 text-white">
          <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              🧪 Demo şoför ekranı — gerçek iş değil.
            </p>
            <form action={demodanDon}>
              <PendingButton className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-violet-700 hover:bg-violet-50">
                Komisyoncu paneline dön
              </PendingButton>
            </form>
          </div>
        </div>
      )}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-slate-500">Şoför</p>
            <p className="font-semibold text-slate-900">{u.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
