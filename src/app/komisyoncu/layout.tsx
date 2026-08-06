// KOMİSYONCU PANELİ ÜST ŞERİDİ (2026-08-06).
//
// 🔴 NEDEN SONRADAN EKLENDİ: komisyoncunun `layout.tsx` dosyası HİÇ YOKTU.
// Bu yüzden panel · şoför · admin · destek · muhasebe layout'larının hepsinde
// bulunan **çıkış butonu komisyoncuda yoktu** — kullanıcının deyişiyle
// *"her çıktığında geri girmek zorunda"*. Sayfa gövdeleri doğrudan render
// ediliyordu, ortak bir başlık yeri yoktu.
//
// Layout seçildi (page'e buton eklemek yerine) çünkü alt sayfaları da
// kapsıyor: /komisyoncu/bolgeler, /komisyoncu/rehberler ve rehber detayları.
// Böylece komisyoncu HANGİ ekranda olursa olsun çıkabiliyor.
//
// ⚠️ Yetki kapısı burada DEĞİL: her sayfa kendi `getSessionUser()` +
// `role !== "AGENT"` kontrolünü prisma'dan ÖNCE yapıyor (app-router yetki
// sızıntısı dersi — layout'un redirect'ine güvenilmez, layout ile page
// paralel render edilir). Bu dosya yalnız görünüm.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";

export default async function KomisyoncuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await getSessionUser();
  if (!u) redirect("/giris");
  if (u.role !== "AGENT") redirect("/giris");

  // HAFİF: yalnız başlıkta gösterilecek ad + baş komisyoncu rozeti.
  const agent = await prisma.agent.findUnique({
    where: { userId: u.id },
    select: { isHead: true },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3 lg:max-w-5xl">
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-500">
              {agent?.isHead ? "Baş Komisyoncu" : "Komisyoncu"}
            </p>
            <Link
              href="/komisyoncu"
              className="block truncate font-semibold text-slate-900 hover:underline"
            >
              {u.name}
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>
      {/* pb-[calc(...)] — panel layout'uyla aynı gerekçe: sabit alt çubuk
          yüksekliği cihaza göre değişiyor, sabit rezerv son satırı kapatıyordu. */}
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-6 lg:max-w-5xl">
        {children}
      </main>
    </div>
  );
}
