// İşletme doğrulama durumu (CleanerBusiness.verification) için ortak Türkçe
// etiket + rozet stili — panel özeti ve admin tablosu aynı kaynağı kullanır.
export const VERIF_META: Record<string, { label: string; cls: string }> = {
  VERIFIED: { label: "Doğrulanmış ✓", cls: "bg-green-100 text-green-700" },
  PENDING: { label: "Onay bekliyor", cls: "bg-amber-100 text-amber-700" },
  REJECTED: { label: "Reddedildi", cls: "bg-red-100 text-red-700" },
};

/** Bilinmeyen/yeni durumlara karşı güvenli erişim. */
export function verifMeta(status: string): { label: string; cls: string } {
  return (
    VERIF_META[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" }
  );
}

/** Abonelik durumu Türkçe etiketi: yalnız ACTIVE anlamlı, gerisi "—". */
export function subscriptionLabel(status?: string | null): string {
  return status === "ACTIVE" ? "Aktif" : "—";
}
