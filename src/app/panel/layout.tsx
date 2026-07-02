import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/panel";
import { LogoutButton } from "@/components/LogoutButton";

const NAV = [
  { href: "/panel", label: "Özet" },
  { href: "/panel/yeni-siparis", label: "Yeni Kayıt" },
  { href: "/panel/siparisler", label: "Siparişler" },
  { href: "/panel/profil", label: "Profil & Fiyat" },
  { href: "/panel/soforler", label: "Şoförler" },
  { href: "/panel/takip", label: "Canlı Takip" },
  { href: "/panel/rota", label: "Rota Geçmişi" },
  { href: "/panel/rapor", label: "Raporlar" },
];

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const business = await getCurrentBusiness();
  if (!business) redirect("/giris");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-slate-400">Halıcı Paneli</p>
            <p className="font-semibold text-slate-900">{business.name}</p>
          </div>
          <LogoutButton />
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
