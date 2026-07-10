import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
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

  return (
    <div className="min-h-screen bg-slate-50">
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
