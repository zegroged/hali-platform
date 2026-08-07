import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";
import PanelNav from "@/components/PanelNav";
import OturumTazele from "@/components/OturumTazele";
import { demoBiletiVarMi } from "@/lib/auth";
import { getPanelErisim } from "@/lib/panelYetki";
import { demodanDon } from "@/app/komisyoncu/demo-actions";
import { demoGunuTazele } from "@/lib/demoPanel";
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

  // ÇALIŞAN PANELİ (2026-08-06): panele artık İKİ rol girebiliyor — işletme
  // sahibi (CLEANER) ve dükkân çalışanı (STAFF). İşletme kimliği role göre
  // farklı yoldan bulunur; ötesi aynı panel.
  const erisim = await getPanelErisim();
  if (!erisim) redirect("/giris");

  // HAFİF: layout yalnız işletme adına ihtiyaç duyar; getCurrentBusiness'in tüm
  // grafiğini (şoför/fiyat/bölge/foto) çekmesi her panel işleminde yeniden-render'ı
  // yavaşlatıyordu. Yalnız ad + varlık kontrolü çek.
  const business = await prisma.cleanerBusiness.findUnique({
    where: { id: erisim.businessId },
    select: { id: true, name: true, isDemo: true },
  });
  if (!business) redirect("/giris");
  const calisan = erisim.rol === "STAFF";

  // DEMO TAZELEME (2026-08-03): demo verisi kurulduğu ana çakılıydı; ertesi gün
  // Canlı Takip "konum yok", Rota Geçmişi boş, Mesajlar'da cevap kutusu kapalı
  // görünüyordu — yani komisyoncunun en güçlü üç satış ekranı ölüydü. Panel her
  // açıldığında demo verisi "bugüne" çekilir. GERÇEK işletme bu yoldan geçmez:
  // koşul burada, ikinci kontrol de fonksiyonun içinde (isDemo).
  if (business.isDemo) await demoGunuTazele(business.id);

  // DEMO ŞERİDİ (2026-08-02): komisyoncu tek tıkla demo hesabına geçtiyse
  // buradan tek tıkla kendi paneline döner (şifre sorulmaz, bilet çerezde).
  const demodaMi = await demoBiletiVarMi();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Oturum kaysın: panel kullanıldıkça çerez 30 güne döner — halıcı bir
          daha şifre sormasın (2026-08-07 akşam). */}
      <OturumTazele />
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
          <div className="min-w-0">
            {/* Çalışan hangi hesapla girdiğini BİLMELİ: patronun hesabı sanıp
                "kasa nerede" diye aramasın, ayrıca ortak telefonda kimin açık
                olduğu görünsün. */}
            <p className="truncate text-xs text-slate-500">
              {calisan ? `Çalışan · ${erisim.kullaniciAdi}` : "Halıcı Paneli"}
            </p>
            <p className="truncate font-semibold text-slate-900">{business.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
        <PanelNav rol={erisim.rol} />
      </header>
      {/* 🔴 ALT ÇUBUK REZERVİ (2026-08-06 düzeltildi — kullanıcı ekran görüntüsü:
          /panel/kasa'nın son paragrafı çubuğun altında kalıyordu).
          ESKİSİ `pb-24` = 96px SABİTTİ. Ama çubuğun yüksekliği DEĞİŞKEN:
            min-h-[56px] + py-1 (8px) + border-t (1px)
            + pb-[env(safe-area-inset-bottom)]  ← cihaza göre 24-48px
          = 89-113px. Sistem gezinme çubuğu olan telefonda safe-area büyüyor,
          96px yetmiyor ve içerik kapanıyordu.
          Rezerv artık AYNI değişkeni içeriyor → hangi cihazda olursa olsun
          çubuk kadar boşluk kalıyor. 6rem = eski 96px'in tabanı. */}
      <main className="mx-auto max-w-3xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:pb-6 lg:max-w-5xl">
        {children}
      </main>
    </div>
  );
}
