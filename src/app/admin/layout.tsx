import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";

// Admin sayfaları arama motorlarına kapalı.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await getSessionUser();
  if (!u || u.role !== "ADMIN") redirect("/giris");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 lg:max-w-5xl">
          <p className="font-semibold text-slate-900">Platform Admin</p>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 lg:max-w-5xl">{children}</main>
    </div>
  );
}
