import { getPanelErisim } from "@/lib/panelYetki";
import { modulGerekir } from "@/lib/paketYetki";
import { getPanelBusiness } from "@/lib/panel";
import { RouteHistory } from "@/components/RouteHistory";
import EmptyState from "@/components/EmptyState";
import { IconMapPin } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function RotaPage() {
  const b = await getPanelBusiness();
  if (!b) return null;
  // PAKET KAPISI — sayfanın kendi verisine dokunmadan önce (FIYAT §1-C).
  modulGerekir(b.subscription, "ROTA_GECMISI");

  const drivers = b.drivers.map((d) => ({ id: d.id, name: d.user.name }));
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Çalışan şoför YÖNETEMEZ: ona kapalı sayfaya buton gösterme (2026-08-06).
  const calisanMi = (await getPanelErisim())?.rol === "STAFF";

  if (drivers.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">Rota Geçmişi</h1>
        <EmptyState
          icon={<IconMapPin size={22} />}
          title="Henüz şoför yok"
          description={
            calisanMi
              ? "Rota geçmişi, şoförlerin mesaideyken kaydettiği konumlardan oluşur. İşletmede henüz şoför yok — sahibine bildir."
              : "Rota geçmişi, şoförlerin mesaideyken kaydettiği konumlardan oluşur. Önce bir şoför ekle."
          }
          {...(calisanMi
            ? {}
            : { actionHref: "/panel/soforler", actionLabel: "Şoför ekle" })}
        />
      </div>
    );
  }

  return <RouteHistory drivers={drivers} today={today} />;
}
