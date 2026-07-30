// FOTOĞRAFLA EŞLEŞTİRME sözlüğü — işletme sahibi QR/barkod yerine bunu seçti.
// Halının yolculuğu üç karede kanıtlanır: alındığı an, yıkanırken, teslim anı.
// Böylece halı kaybolmaz, müşteri süreci izler, tesiste "bu kimin halısı"
// sorusu fotoğrafla cevaplanır.
//
// Bu dosya İSTEMCİDE de import edilir (galeri etiketleri) — bu yüzden içinde
// prisma/sharp gibi sunucu bağımlılığı OLMAMALI.

export const PHOTO_STAGES = ["ALIM", "YIKAMA", "TESLIM"] as const;

export type PhotoStage = (typeof PHOTO_STAGES)[number];

// Müşteriye ve halıcıya gösterilen Türkçe etiketler.
export const PHOTO_STAGE_LABEL: Record<PhotoStage, string> = {
  ALIM: "Alım",
  YIKAMA: "Yıkama",
  TESLIM: "Teslim",
};

export function isPhotoStage(v: unknown): v is PhotoStage {
  return typeof v === "string" && (PHOTO_STAGES as readonly string[]).includes(v);
}

/** Aşama etiketi; aşaması olmayan (eski) fotoğraflarda null döner. */
export function photoStageLabel(stage: string | null | undefined): string | null {
  return isPhotoStage(stage) ? PHOTO_STAGE_LABEL[stage] : null;
}

/** Galeri sıralaması: aşamalar kendi doğal akışında, etiketsizler en sonda. */
export function photoStageRank(stage: string | null | undefined): number {
  const i = isPhotoStage(stage) ? PHOTO_STAGES.indexOf(stage) : -1;
  return i === -1 ? PHOTO_STAGES.length : i;
}
