// Google Maps anahtarı varsa Google, yoksa ücretsiz OSM (Leaflet) haritası kullanılır.
// Anahtarı .env'e NEXT_PUBLIC_GOOGLE_MAPS_KEY olarak ekleyip dev sunucusunu yeniden başlat.
export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
export const hasGoogleMaps = GOOGLE_MAPS_KEY.length > 0;
