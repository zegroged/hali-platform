// FOTOĞRAFLA EŞLEŞTİRME sözlüğü — işletme sahibi QR/barkod yerine bunu seçti.
// Halının yolculuğu üç karede kanıtlanır: alındığı an, yıkanırken, teslim anı.
// Böylece halı kaybolmaz, müşteri süreci izler, tesiste "bu kimin halısı"
// sorusu fotoğrafla cevaplanır.
//
// Bu dosya İSTEMCİDE de import edilir (galeri etiketleri) — bu yüzden içinde
// prisma/sharp gibi sunucu bağımlılığı OLMAMALI.

// MUSTERI (2026-08-06): müşterinin sipariş verirken kendi eklediği kare.
// Kanıt zincirinin PARÇASI DEĞİLDİR — bilgi amaçlıdır (işletme işi görmeden
// fiyat/süre tahmini yapabilsin). Bu yüzden akışın EN BAŞINDA gelir ve
// "Alım"dan önce sıralanır; ayrı etiketle gösterilir ki şoförün çektiği
// zorunlu alım fotoğrafıyla karıştırılmasın.
// SONRADAN (2026-08-10): sipariş TESLİM EDİLDİKTEN (ya da iptal/red olduktan)
// SONRA panelden eklenen kare. Yükleme kısıtlanmadı — meşru kullanımı var
// (müşteri "şu köşenin fotoğrafını atar mısın" der). Ama kanıt zincirinin
// PARÇASI DEĞİLDİR ve öyle görünmemeli: teslimden sonra eklenen bir kare,
// hasar tartışmasında alım/teslim karesiyle aynı ağırlıkta sanılırsa iki tarafı
// da yanıltır. Bu yüzden ayrı etiketle ve akışın EN SONUNDA gösterilir.
export const PHOTO_STAGES = [
  "MUSTERI",
  "ALIM",
  "YIKAMA",
  "TESLIM",
  "SONRADAN",
] as const;

export type PhotoStage = (typeof PHOTO_STAGES)[number];

// Müşteriye ve halıcıya gösterilen Türkçe etiketler.
export const PHOTO_STAGE_LABEL: Record<PhotoStage, string> = {
  MUSTERI: "Müşteri",
  ALIM: "Alım",
  YIKAMA: "Yıkama",
  TESLIM: "Teslim",
  SONRADAN: "Sonradan eklendi",
};

/** Kanıt zincirinin parçası mı? Yalnız şoför akışında çekilen alım/teslim
 *  kareleri kanıttır; müşterinin kendi eklediği ve teslim sonrası eklenenler
 *  bilgi amaçlıdır. Silme koruması ve galeri vurgusu bunu okur. */
export function isKanitStage(stage: string | null | undefined): boolean {
  return stage === "ALIM" || stage === "TESLIM";
}

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
