import { PanelTrackingClient } from "@/components/PanelTrackingClient";
import { getPanelErisim } from "@/lib/panelYetki";

export const dynamic = "force-dynamic";

export default async function PanelTakipPage() {
  // Çalışan şoförün NEREDE olduğunu görür (işinin parçası) ama şoför
  // YÖNETEMEZ — boş durumdaki "Şoför ekle" butonu ona gösterilmez (2026-08-06).
  const calisanMi = (await getPanelErisim())?.rol === "STAFF";
  return <PanelTrackingClient calisanMi={calisanMi} />;
}
