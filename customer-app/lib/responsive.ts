import { useWindowDimensions } from "react-native";

// Telefon "modeli" değil; ekran BOYUTU algılanıp ölçeklenir → her cihazda uyumlu.
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const shortest = Math.min(width, height);
  const isTablet = shortest >= 600;

  // 375px referans; 0.9–1.25 arası yumuşak ölçek (çok küçük/çok büyük ekranı dengeler)
  const k = Math.min(Math.max(width / 375, 0.9), 1.25);
  const scale = (n: number) => Math.round(n * k);

  return {
    width,
    height,
    isTablet,
    scale,
    // tablette içerik aşırı yayılmasın diye orta sütun
    contentMaxWidth: isTablet ? 640 : width,
    cardWidth: isTablet ? 200 : scale(158),
  };
}
