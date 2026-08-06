// DURAK ETİKETİ — harita balonu ve liste aynı metni kullansın (2026-08-06).

/**
 * Durak balonu metni: "14:32 · 18 dk · Yaşiyan Sk."
 * Kullanıcı 2026-08-06: *"noktaların üzerine bastığımda ne zaman ne kadar
 * durduğunu göstermiyor."* Veri (DriverStop.startedAt/durationSec/address)
 * zaten vardı; yalnız haritaya taşınmamıştı.
 */
export function durakEtiketi(s: {
  durationMin: number;
  address: string | null;
  startedAt?: string;
}): string {
  const saat = s.startedAt
    ? new Date(s.startedAt).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
      })
    : null;
  return [saat, `${s.durationMin} dk durdu`, s.address].filter(Boolean).join(" · ");
}
