import type { BadgeType } from "@prisma/client";
import {
  IconCheck,
  IconShield,
  IconBolt,
  IconStar,
  IconThumbUp,
} from "@/components/icons";

const BADGE_META: Record<
  BadgeType,
  { label: string; Icon: (p: { size?: number }) => React.ReactNode }
> = {
  VERIFIED: { label: "Doğrulanmış", Icon: (p) => <IconCheck {...p} /> },
  // Gerçek sigorta poliçesi olmadan "Sigortalı" yanıltıcı ticari uygulama sayılır
  // (6502 md.61/62). Etiket, öncesi-sonrası fotoğraf + işletme sorumluluğu
  // güvencesini dürüstçe yansıtır (bkz. Kullanım Koşulları §5/C).
  // "Güvence" TEMİNAT çağrıştırıyordu; Kullanım Koşulları §5/C ise "sigorta
  // poliçesi değildir" diyor. Şahıs işletmesinde bu çelişki sorumluluk riski
  // (2026-07-29). Rozet artık ne yapıldığını söylüyor, ne vaat edildiğini değil.
  INSURED: { label: "Fotoğraflı Kayıt", Icon: (p) => <IconShield {...p} /> },
  // 2026-08-03: "Hızlı Teslim" işletmenin kendi yazdığı süreye bakıyordu.
  // Artık ölçülen şey SÖZÜN TUTULMASI (bkz. lib/badgeCompute.ts).
  FAST_DELIVERY: { label: "Zamanında Teslim", Icon: (p) => <IconBolt {...p} /> },
  TOP_RATED: { label: "Yüksek Puan", Icon: (p) => <IconStar {...p} filled /> },
  // Artık gerçekten YANIT SÜRESİNİ ölçüyor: son 30 günde siparişlerin
  // %80'i 2 saat içinde kabul edildiyse verilir.
  FAST_RESPONDER: { label: "Hızlı Dönüş", Icon: (p) => <IconThumbUp {...p} /> },
};

export function Badges({
  badges,
  notlar,
}: {
  badges: BadgeType[];
  /** Rozetin hak ediliş gerekçesi (hesaplanan rozetlerde dolu). */
  notlar?: Partial<Record<BadgeType, string>>;
}) {
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => {
        const m = BADGE_META[b];
        return (
          <span
            key={b}
            title={notlar?.[b]}
            className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-xs font-medium text-brand-dark"
          >
            <m.Icon size={12} />
            {m.label}
          </span>
        );
      })}
    </div>
  );
}
