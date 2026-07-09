import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getCurrentBusiness } from "@/lib/panel";
import { LogoutButton } from "@/components/LogoutButton";
import PanelNav from "@/components/PanelNav";

// Panel sayfaları arama motorlarına kapalı (robots.txt'e ek ikinci savunma hattı).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Telefonla giriş kaldırıldı: kullanıcı adı olmayan eski hesap önce onu belirler.
  const u = await getSessionUser();
  if (!u) redirect("/giris");
  if (!u.username) redirect("/kullanici-adi");

  const business = await getCurrentBusiness();
  if (!business) redirect("/giris");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 lg:max-w-5xl">
          <div>
            <p className="text-xs text-slate-500">Halıcı Paneli</p>
            <p className="font-semibold text-slate-900">{business.name}</p>
          </div>
          <LogoutButton />
        </div>
        <PanelNav />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 lg:max-w-5xl">{children}</main>
    </div>
  );
}
