import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

// Müşteri hizmetleri sayfaları arama motorlarına kapalı.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// SUPPORT (müşteri hizmetleri) alanı — admin de görebilir. SUPPORT'un
// platformdaki TEK yetkili alanı burasıdır; /admin ona kapalıdır.
export default async function DestekLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await getSessionUser();
  if (!u || (u.role !== "SUPPORT" && u.role !== "ADMIN")) redirect("/giris");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <p className="font-semibold text-slate-900">Müşteri Hizmetleri</p>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
