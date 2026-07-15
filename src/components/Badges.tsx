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
  INSURED: { label: "Fotoğraflı Güvence", Icon: (p) => <IconShield {...p} /> },
  FAST_DELIVERY: { label: "Hızlı Teslim", Icon: (p) => <IconBolt {...p} /> },
  TOP_RATED: { label: "Çok Tercih Edilen", Icon: (p) => <IconStar {...p} filled /> },
  // Ölçtüğü şey düşük red oranı (kabul güvenilirliği) — yanıt SÜRESİ değil.
  FAST_RESPONDER: { label: "Güvenilir", Icon: (p) => <IconThumbUp {...p} /> },
};

export function Badges({ badges }: { badges: BadgeType[] }) {
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => {
        const m = BADGE_META[b];
        return (
          <span
            key={b}
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
