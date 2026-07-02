"use client";

// Panel sekme çubuğu: usePathname ile aktif sekme vurgusu, gizli scrollbar
// ve dar ekranda "devamı var" hissi veren sağ kenar fade'i.
import Link from "next/link";
import { usePathname } from "next/navigation";

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

export default function PanelNav() {
  const pathname = usePathname() ?? "";

  return (
    <div className="relative mx-auto max-w-3xl lg:max-w-5xl">
      <nav className="no-scrollbar flex gap-1 overflow-x-auto px-2 pb-2">
        {NAV.map((n) => {
          // /panel tam eşleşme ister; alt sayfalar prefix ile eşleşir.
          const active =
            n.href === "/panel"
              ? pathname === "/panel"
              : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-brand-light font-semibold text-brand-dark"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
      {/* Dar ekranda ekran dışında kalan sekmelerin ipucu: sağ kenar fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white md:hidden"
      />
    </div>
  );
}
