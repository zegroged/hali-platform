import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";
import PanelNav from "@/components/PanelNav";
import { demoBiletiVarMi } from "@/lib/auth";
import { demodanDon } from "@/app/komisyoncu/demo-actions";
import { PendingButton } from "@/components/PendingButton";

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

  // HAFİF: layout yalnız işletme adına ihtiyaç duyar; getCurrentBusiness'in tüm
  // grafiğini (şoför/fiyat/bölge/foto) çekmesi her panel işleminde yeniden-render'ı
  // yavaşlatıyordu. Yalnız ad + varlık kontrolü çek.
  const business = await prisma.cleanerBusiness.findUnique({
    where: { ownerId: u.id },
    select: { name: true },
  });
  if (!business) redirect("/giris");

  // DEMO ŞERİDİ (2026-08-02): komisyoncu tek tıkla demo hesabına geçtiyse
  // buradan tek tıkla kendi paneline döner (şifre sorulmaz, bilet çerezde).
  const demodaMi = await demoBiletiVarMi();

  return (
    <div className="min-h-screen bg-slate-50">
      {demodaMi && (
        <div className="sticky top-0 z-30 bg-violet-600 px-4 py-2 text-white">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 lg:max-w-5xl">
            <p className="text-sm font-medium">
              🧪 Demo panelindesin — buradaki hiçbir şey gerçek değil.
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
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 lg:max-w-5xl">
          <div>
            <p className="text-xs text-slate-500">Halıcı Paneli</p>
            <p className="font-semibold text-slate-900">{business.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
        <PanelNav />
      </header>
      {/* pb-24 (mobil): sabit alt çubuk son satırı kapatmasın. */}
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pb-6 lg:max-w-5xl">
        {children}
      </main>
    </div>
  );
}
