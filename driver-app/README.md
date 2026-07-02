# Halı Şoför — Native Uygulama (Expo)

Şoförlerin **arka planda konum paylaşımı** için native uygulama. Şoför uygulamayı
kapatsa, ekranı kilitlese, telefonla konuşsa bile konum iletilmeye devam eder —
web'in yapamadığı tek şey buydu.

Backend değişmez: mevcut `/api/auth/login` (token döndürür), `/api/driver/shift`,
`/api/driver/location` (Bearer token ile) kullanılır. Halıcının canlı haritası,
durak tespiti, müşteri tarafı aynen çalışır.

## Nasıl çalışır
1. Şoför telefon + şifre ile girer → backend **token** döndürür (cihazda saklanır).
2. "Mesaiye Başla" → `expo-location` arka plan görevi başlar (foreground service +
   "Her zaman konum" izni).
3. Her ~25 m / 8 sn'de konum, **Bearer token** ile `/api/driver/location`'a gider.
4. Durak tespiti ve harita sunucuda; hiçbir şey değişmez.

## Kurulum (geliştirme)
```bash
cd driver-app
npx create-expo-app@latest .   # (boş klasöre değilse atla) — ya da direkt:
npm install
npx expo install expo-location expo-task-manager expo-secure-store react-native-safe-area-context
```
> `npx expo install` SDK ile uyumlu sürümleri ayarlar (package.json'daki sürümler referans).

**Önemli:** `API_BASE` artık ortam değişkeninden gelir. `EXPO_PUBLIC_API_BASE`'i ayarla
(dev: `http://<PC-LAN-IP>:3000`, üretim: EAS profilinde `https://...`). Eski referans:
- Geliştirme: PC'nin LAN IP'si, ör. `http://192.168.0.11:3000` (telefon ve PC aynı ağda).
- Prod: yayınlanan **HTTPS** adresi.

## Çalıştırma
- **Foreground testi (hızlı):** `npx expo start` → Expo Go ile telefonda aç. *(Expo Go arka plan
  konumunu TAM desteklemez; gerçek arka plan için aşağıdaki build şart.)*
- **Gerçek arka plan (EAS build):**
  ```bash
  npm i -g eas-cli
  eas login
  eas build --profile development --platform android   # veya ios
  ```
  Çıkan APK/IPA'yı telefona kurup test et. Arka plan konumu yalnız gerçek build'de tam çalışır.

## Dağıtım — bilmen gerekenler (dürüst liste)
- **Apple Developer hesabı** ($99/yıl) — TestFlight/App Store için.
- **Google Play Developer** ($25 tek sefer) — ya da doğrudan APK dağıtımı.
- **Apple incelemesi:** "Her zaman konum"u sıkı inceler; **kurye/lojistik** gerekçesiyle
  (şoför takibi) doğru açıklama yazılırsa onaylanır.
- **Pil:** arka plan GPS pil yer; `distanceInterval/timeInterval` ile dengelendi.
- **Android 14+:** `FOREGROUND_SERVICE_LOCATION` izni eklendi (app.json).

## Dosyalar
- `src/api.ts` — login (token), shift, konum gönderme (Bearer).
- `src/tracking.ts` — arka plan konum görevi + başlat/durdur.
- `App.tsx` — giriş + mesai aç/kapa ekranı.
- `app.json` — izinler + arka plan modları.
