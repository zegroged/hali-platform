import { getCurrentBusiness } from "@/lib/panel";
import { RouteHistory } from "@/components/RouteHistory";

export const dynamic = "force-dynamic";

export default async function RotaPage() {
  const b = await getCurrentBusiness();
  if (!b) return null;

  const drivers = b.drivers.map((d) => ({ id: d.id, name: d.user.name }));
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  if (drivers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
        Önce şoför ekleyin.
      </div>
    );
  }

  return <RouteHistory drivers={drivers} today={today} />;
}
