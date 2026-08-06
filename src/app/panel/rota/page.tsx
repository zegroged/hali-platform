import { getPanelBusiness } from "@/lib/panel";
import { RouteHistory } from "@/components/RouteHistory";
import EmptyState from "@/components/EmptyState";
import { IconMapPin } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function RotaPage() {
  const b = await getPanelBusiness();
  if (!b) return null;

  const drivers = b.drivers.map((d) => ({ id: d.id, name: d.user.name }));
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  if (drivers.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">Rota Geçmişi</h1>
        <EmptyState
          icon={<IconMapPin size={22} />}
          title="Henüz şoför yok"
          description="Rota geçmişi, şoförlerin mesaideyken kaydettiği konumlardan oluşur. Önce bir şoför ekle."
          actionHref="/panel/soforler"
          actionLabel="Şoför ekle"
        />
      </div>
    );
  }

  return <RouteHistory drivers={drivers} today={today} />;
}
