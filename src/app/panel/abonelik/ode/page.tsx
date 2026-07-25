import { redirect } from "next/navigation";

// Talimat ödemesi PANEL DIŞINA taşındı (2026-07-25): gömülü iyzico formu panel
// başlığı/menüsünün katmanları arkasında kalıyordu. Eski bağlantılar/yer imleri
// kırılmasın diye burası yeni sayfaya yönlendirir.
export default function EskiOdeYolu() {
  redirect("/odeme/abonelik");
}
