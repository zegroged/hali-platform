# Halını Aldır — Müşteri Uygulaması (Expo)

App Store + Play Store için tüketici uygulaması. Web ile **aynı backend'i** kullanır
(`/api/businesses`, `/api/businesses/[id]`, `/api/orders`, `/api/orders/[token]` ...).

Müşteri uygulaması **arka plan konumu gerektirmez** → **Expo Go ile doğrudan test edebilirsin**
(şoför uygulamasının aksine, EAS build şart değil).

## Ekranlar (tamam)
- **Ana keşif** (`screens/HomeScreen.tsx`): konumla "Sana en yakın" + En çok tercih / Hızlı teslim / Yeni satırları (gerçek backend, kapak fotoğrafları). Kart → profil.
- **Profil** (`ProfileScreen`): fiyat / foto / saat / yorum / rozet + "Halımı Aldır".
- **Sipariş** (`OrderScreen`): form → `/api/orders` → takip koduna düşer.
- **Takip** (`TrackScreen`): kod gir → durum adımları; şoför teslime çıkınca canlı bilgi (5 sn poll).
- Navigasyon: basit yığın (`App.tsx`), harici router yok. Responsive (`lib/responsive.ts`) + safe-area.

## Sıradaki (opsiyonel)
- Canlı takipte harita: `react-native-maps` (Google Maps anahtarı gerekir).

## Kurulum & çalıştırma
```bash
cd customer-app
npm install
npx expo install expo-location expo-status-bar react-native-safe-area-context
```
**Önemli:** `lib/api.ts` → `API_BASE`'i backend adresinle değiştir (dev: PC LAN IP; prod: HTTPS).

```bash
npx expo start    # telefonda Expo Go ile QR okut → çalışır
```

## Dağıtım
- `eas build` → APK/IPA → mağaza. **Apple Developer** ($99/yıl), **Google Play** ($25).
- Müşteri uygulaması mağaza onayı kolaydır (normal tüketici app'i; özel izin yok).
