# Müşteri Uygulaması — Mağaza Gönderim Rehberi (Google Play)

> Şoför uygulamasının rehberiyle (driver-app/STORE.md) aynı akış; farklar:
> arka plan konum YOK (inceleme çok daha kolay), giriş YOK (inceleme hesabı
> gerekmez), Google Maps Android anahtarı GEREKLİ (canlı şoför haritası).

## 0. Ön koşullar

- [ ] Google Play Console şahıs hesabı (şoför uygulamasıyla AYNI hesap kullanılır — ikinci ücret yok).
- [ ] `npm i -g eas-cli` + `eas login` (Expo hesabı).
- [ ] **Android Google Maps anahtarı** (aşağıda §1) — bunsuz üretim derlemesinde
      takip haritası çöker.

## 1. Google Maps Android anahtarı (TEK seferlik, ~10 dk)

Webdeki anahtar HTTP-referrer kısıtlı olduğu için uygulamada ÇALIŞMAZ; ayrı
anahtar gerekir:

1. https://console.cloud.google.com → mevcut proje ("My First Project",
   [EPOSTA]).
2. "APIs & Services → Library" → **Maps SDK for Android** → Enable.
3. "Credentials → Create credentials → API key" → adı: `hali-customer-android`.
4. Anahtarı KISITLA: Application restrictions → **Android apps** →
   paket adı `com.enyakinhaliyikamaservisi.customer` + SHA-1 imza parmak izi.
   - SHA-1'i EAS verir: `eas credentials` → Android → production → Keystore →
     "SHA-1 Fingerprint" satırı. (İlk build'den SONRA da eklenebilir; anahtar
     kısıtsız bırakılıp build sonrası kısıtlamak pratik yol.)
   - API restrictions → yalnız **Maps SDK for Android**.
5. Anahtarı `app.json` → `android.config.googleMaps.apiKey` alanına yaz
   (şu an `ANDROID_GOOGLE_MAPS_ANAHTARI_BURAYA` placeholder).

## 2. Derleme

```bash
cd customer-app
npm install
eas init                 # ilk sefer: Expo projesi bağlar
eas build -p android --profile production   # .aab üretir (mağaza)
# telefonda hızlı denemek için: eas build -p android --profile preview  (.apk)
```

- Üretim API adresi eas.json'da gömülü: `https://enyakinhaliyikamaservisi.com`.
- `versionCode` her mağaza gönderiminde +1 artırılır (app.json).
- ⚠️ Paket adı `com.enyakinhaliyikamaservisi.customer` — yayından sonra ASLA değişmez.

## 3. Play Console — uygulama oluşturma

- Ad: **En Yakın Halı Yıkama** · Varsayılan dil: Türkçe · Uygulama (oyun değil) · Ücretsiz.
- İç test/kapalı test: şoför uygulamasındaki gibi 12 test kullanıcısı × 14 gün
  kuralı şahıs hesaplarında burada da geçerli — aynı test listesi kullanılabilir.

### Mağaza girişi (kopyala-yapıştır)

**Kısa açıklama (80):**
`Halın kapından alınsın: en yakın halı yıkamacıyı bul, sipariş ver, canlı takip et.`

**Uzun açıklama:**
```
En Yakın Halı Yıkama ile halı yıkatmak üç adım:

📍 BUL — Konumunu kullan, yakınındaki halı yıkamacıları puanlarıyla,
fiyatlarıyla ve teslim süreleriyle karşılaştır.

🚚 ALDIR — Siparişini ver, halın kapından alınsın. Ön ödeme yok, kapora yok;
ödeme halın temiz teslim edildiğinde, kapıda.

📦 TAKİP ET — Takip kodunla her adımı canlı izle: alındı, yıkanıyor, yolda,
teslim edildi. Şoför teslime çıktığında konumunu haritada gör.

Üstelik:
• Kesin fiyat, halın ölçüldükten sonra ONAYINA sunulur — onaylamazsan halın
  yıkanmadan ücretsiz geri getirilir.
• Alım ve teslimde fotoğraflı kayıt: halın güvende.
• Beğenmediysen vazgeç: halı alınmadan ücretsiz iptal.

Şehir şehir büyüyoruz. Bölgende henüz işletme yoksa uygulamadan haber isteyebilirsin — ilk işletme açıldığında sana bildirim gelir.
```

- Uygulama simgesi: `store-assets/play-icon-512.png`
- Öne çıkan görsel: `store-assets/feature-graphic-1024x500.png`
- Ekran görüntüleri: preview .apk telefona kurulup 4-6 ekran çekilir
  (ana liste, işletme profili, sipariş formu, takip ekranı).

### Veri güvenliği formu (Data Safety) — cevaplar

- Veri toplanıyor mu? **Evet.**
- **Konum (yaklaşık + kesin):** toplanıyor, YALNIZ uygulama içi işlev
  (yakındaki işletmeleri sıralama) için; üçüncü tarafla PAYLAŞILMIYOR,
  cihaz dışına yalnız arama sorgusu olarak gidiyor, saklanmıyor. Opsiyonel
  (kullanıcı "Konumumu kullan"a basarsa).
- **Kişisel bilgiler (ad, telefon, adres):** sipariş oluştururken toplanır,
  hizmetin ifası için SİPARİŞ VERİLEN İŞLETMEYLE paylaşılır (şoför halıyı
  adresten alır). Hesap gerekmez. Saklama: sunucuda sipariş kaydı (yasal
  saklama süreleri gizlilik politikasında).
- **Cihaz veya diğer kimlikler:** toplanıyor — Google Maps SDK (canlı şoför
  haritası) cihaz tanımlayıcılarını Google'a iletir. Google'ın resmî "data
  disclosure requirements for Maps SDK" rehberi gereği bu beyan ZORUNLU:
  "Device or other IDs → collected, shared (Google), app functionality,
  not user-optional (harita ekranında)". Beyan edilmezse Play reddeder.
- Veriler şifreli aktarılıyor mu? **Evet (HTTPS).**
- Silme talebi: gizlilik politikasındaki destek e-postasıyla.
- Gizlilik politikası URL: `https://enyakinhaliyikamaservisi.com/gizlilik`

### İnceleme notları (App access)

- "All functionality is available without special access" — GİRİŞ YOK,
  inceleme hesabı gerekmez. Sipariş akışını görmek isteyen inceleyici test
  işletmesine sipariş verebilir (gerçek işlem oluşur, sorun değil).

## 4. Yayın sonrası

- [ ] Maps anahtarını SHA-1 ile kısıtla (§1/4 yapılmadıysa).
- [ ] `versionCode` artırarak güncelleme gönder (`eas build` → Console'a yükle).
- [ ] iOS istenirse: Apple Developer hesabı (99$/yıl) + `eas build -p ios`;
      kod hazır, ekstra izin yok.

## Bilinen sınırlar (bilinçli)

- Kartlı ödeme UI'da yok (web ile aynı — iyzico canlıya alınınca ikisine birden eklenir).
- Yorum bırakma yalnız webde (üyelik/giriş web'de; app'te takip linki webe açılabilir).
- Push bildirimi yok (sipariş durumu 6 sn'de bir yenilenen takip ekranından izlenir);
  istenirse şoför push işiyle birlikte eklenir.
