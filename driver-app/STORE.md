# Halı Şoför — Google Play Gönderim Rehberi

> Bu dosya uygulamayı Play'e göndermek için gereken HER ŞEYİ içerir.
> Kod tarafı hazır (2026-07-10): ikonlar, eas.json, prod API adresi,
> belirgin açıklama (prominent disclosure), gizlilik linki, uygulama içi
> hata geri-alma. Kalan adımlar Expo/Play hesaplarıyla yapılır.

## 0. Ön koşullar
- **KARAR (2026-07-10): ŞAHIS hesap** (D-U-N-S beklenmeyecek — o 3-6 hafta
  sürüyor). Google Play Developer hesabı 25 $ tek sefer. Şahıs hesapta kural:
  **en az 12 testçi × 14 gün kesintisiz kapalı test** → sonra herkese açık
  yayına başvurulabilir. (Kurumsal + D-U-N-S bu şarttan muaftı ama beklemeye
  değmez; istersen paralel başvurup sonra geçersin.)
- Ücretsiz Expo hesabı (expo.dev) — build bulutunda alınır, yerel Android
  Studio GEREKMEZ.

### Şahıs hesap + kapalı test — özet sıra
1. Play Console hesabı aç (25 $, kimlik doğrulaması birkaç gün sürebilir).
2. `eas build` ile .aab üret (Bölüm 1).
3. Uygulama oluştur + tüm formları doldur (Bölüm 2-8).
4. **Closed testing** track'i aç, .aab'ı yükle, 12+ testçi Gmail'ini ekle.
5. Testçiler linke tıklayıp uygulamayı kurar, **14 gün boyunca** ara sıra
   açar (Google katılımı izler; herkesin her gün açması şart değil ama aktif
   kullanım beklenir).
6. 14 gün + en az 12 aktif testçi dolunca "Production'a başvur" açılır.

## 1. Build (bu klasörde)
```bash
npm install
npx expo-doctor            # sürüm uyumu kontrolü
npm i -g eas-cli
eas login                  # Expo hesabınla
eas init                   # projeyi hesabına bağlar (app.json'a projectId yazar)
eas build -p android --profile production   # → .aab dosyası (Play'e yüklenecek)
# Telefonda ön deneme istersen: eas build -p android --profile preview  (→ .apk)
```
- Üretim API adresi eas.json'da gömülü: `https://enyakinhaliyikamaservisi.com`.
- İmzalama: EAS keystore'u kendisi üretir/saklar; Play'de "Play App Signing"i kabul et.
- versionCode app.json'da (`android.versionCode`) — her yeni yüklemede +1 yap.

## 2. Play Console — uygulama oluşturma
- Uygulama adı: **Halı Şoför** · Dil: Türkçe · Tür: Uygulama · Ücretsiz.
- Kategori: **İş (Business)** · İletişim e-postası: destek@enyakinhaliyikamaservisim.com
- Gizlilik politikası URL'si: **https://enyakinhaliyikamaservisi.com/gizlilik**
  (mobil/şoför bölümü eklendi — arka plan konumu açıkça kapsar).

## 3. Mağaza görselleri (store-assets/ klasöründe HAZIR)
- Uygulama ikonu 512×512: `store-assets/play-icon-512.png`
- Feature graphic 1024×500: `store-assets/feature-graphic-1024x500.png`
- Ekran görüntüleri (min 2): preview APK'yı telefona kur, giriş ekranı +
  mesai ekranının görüntüsünü al (dikey, 1080×1920 önerilir).

## 4. Mağaza metinleri (kopyala-yapıştır)
**Kısa açıklama (≤80):**
`Halı yıkama şoförleri için mesai ve canlı konum uygulaması.`

**Uzun açıklama:**
```
Halı Şoför, enyakinhaliyikamaservisi.com platformuna bağlı halı yıkama
işletmelerinin şoförleri içindir.

• Tek dokunuşla mesaiye başla / bitir
• Mesai boyunca konumun, uygulama kapalıyken bile işletmene iletilir
• Müşteriler "halım nerede?" sorusunun cevabını canlı haritada görür
• Mesai bittiğinde konum paylaşımı tamamen durur

Not: Bu uygulama şoförler içindir; giriş bilgilerini çalıştığın halı yıkama
işletmesinden alabilirsin. Müşteriler sipariş ve takip için web sitesini kullanır.

Konum verisi yalnız sipariş takibi ve rota kaydı için kullanılır, üçüncü
taraflarla paylaşılmaz. Ayrıntı: enyakinhaliyikamaservisi.com/gizlilik
```

## 5. Data Safety (Veri Güvenliği) formu — cevaplar
- Veri topluyor mu? **Evet.**
- **Konum > Hassas konum:** Toplanıyor. Paylaşılıyor (yalnız şoförün bağlı
  olduğu işletmeyle, platform üzerinden). Amaç: *Uygulama işlevselliği*.
  Kimliğe bağlı: Evet. Geçici değil (sunucuda saklanır; 12 ayı aşan kayıtlar
  otomatik silinir). Toplama isteğe bağlı mı: kullanıcı mesaiyi başlatınca —
  "users can choose whether data is collected" işaretle.
- **Kişisel bilgiler > Ad, Kullanıcı kimliği:** Toplanıyor (hesap yönetimi).
  Paylaşılmıyor.
- **Toplanmayanlar:** reklam kimliği, analitik, çökme günlüğü, rehber,
  SMS/arama, fotoğraf, mikrofon, finansal, sağlık → hepsine Hayır.
- Aktarımda şifreleme: **Evet (HTTPS).** Veri silme talebi kanalı: gizlilik
  sayfasındaki e-posta.

## 6. Arka plan konumu beyanı (Play'in en sıkı incelediği kısım)
- Console > App content > **Location permissions** formu:
  - Özellik: "Şoförün mesai süresince canlı konum paylaşımı — müşteri sipariş
    takibi ve işletme operasyonu (kurye/lojistik)".
  - Uygulama, izin istemeden ÖNCE uygulama içi belirgin açıklama gösterir
    ("Mesaiye Başla" → onay diyaloğu → izinler). Bu akış kodda hazır.
- **Kısa demo videosu** (YouTube, herkese açık/liste dışı): giriş → Mesaiye
  Başla → açıklama diyaloğu → izin ekranları → "Mesaidesin" bildirimi.
  Telefon ekran kaydı yeterli (30-60 sn).

## 7. İnceleme için demo hesabı (App access)
- Console > App content > **App access** > "All or some functionality is
  restricted" → şu hesabı gir:
  - Kullanıcı adı: `play.demo` · Şifre: `PlayDemo-2026` 
  - (Prod'da tanımlı, test işletmesine bağlı şoför. **Lansmanda test
    işletmeleri silinirken BU HESABI SİLME** — DEVIR notu.)

## 8. Hedef kitle
- 18+ seç ("çocuklara yönelik değil") — arka plan konumlu uygulama çocuk
  hedefleyemez. İçerik derecelendirme anketi: Utility/araç, şiddet yok.

## 9. Yayın (şahıs hesap yolu)
1. **Testing > Closed testing > Create track.** .aab'ı buraya yükle.
2. **Testers** sekmesi: bir e-posta listesi oluştur, **12+ testçi Gmail'i**
   ekle (halıcı adayları + tanıdıklar; test sırasında düşme olmasın diye 14-15
   kişi ekle — tampon). "Copy link" ile davet linkini testçilere gönder.
3. Testçiler linke girip "Become a tester" → Play'den kurar. Herkesin GERÇEK
   cihazda kurup birkaç kez açması gerekir (Google aktif katılımı ölçer).
4. **14 gün kesintisiz** + ≥12 aktif testçi sağlanınca Console "Apply for
   production" seçeneğini açar → başvur.
5. **Production > Create release** → aynı .aab → incele → Rollout.
- İnceleme süresi: genelde 1-7 gün (arka plan konumu + demo video nedeniyle
  uzayabilir; disclosure akışı ve demo hesap hazır olduğundan takılmamalı).
- Sonraki güncellemeler: `android.versionCode`'u +1 yap, `eas build`, yeni
  .aab'ı Production'a yükle (kapalı test tekrar gerekmez).

## iOS notu
App Store ayrı iş: Apple Developer 99 $/yıl + `eas build -p ios` +
"Her zaman konum" için ayrı sıkı inceleme. Play yayını oturunca yapılır.
