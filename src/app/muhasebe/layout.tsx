import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

// Mali müşavir alanı arama motorlarına kapalı.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MuhasebeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await getSessionUser();
  // YALNIZ mali müşavir (ACCOUNTANT) veya ADMIN. Kendi rol kontrolünü yapar —
  // layout redirect'ine güvenmez (middleware yok). ACCOUNTANT admin paneline giremez.
  if (!u || (u.role !== "ACCOUNTANT" && u.role !== "ADMIN")) redirect("/giris");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-slate-500">Mali Müşavir</p>
            <p className="font-semibold text-slate-900">Fatura & Ödemeler</p>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
