# KİLİT ÖZELLİKLER — PLAN (2026-07-29)

> Amaç: halıcının panelden **ayrılamaması**. Eksik özellik listesi sonsuzdur;
> kilit yaratan liste kısadır. Bu belge, 6 alanda yapılan kod tabanı ve
> mevzuat araştırmasının sonucudur — tahmin değil, dosya:satır kanıtına dayanır.
>
> ⚠️ **Bu plandaki hiçbir madde CANLIYA ALINMADI.** İşletme sahibinin emri
> beklenmektedir.

---

## 0. ARAŞTIRMANIN DEĞİŞTİRDİĞİ ŞEY

Sıralama önerisi "etiketleme → tahsilat → WhatsApp → hatırlatma → cari" idi.
Araştırma bunu **değiştirdi**, çünkü üç ayrı alanın altında **aynı kök neden**
çıktı:

### 🔴 Kök neden: tahsilat yalanı üç yerde kodlanmış

Teslim anında nakit siparişte `paymentStatus` **koşulsuz `PAID`** yazılıyor:

- `src/app/panel/actions.ts:757`
- `src/app/sofor/actions.ts:237`
- `src/lib/driverOrders.ts:253` (mobil uygulamanın sunucu tarafı)

Web'de `paymentMethod` zaten hep `CASH` (`api/orders/route.ts:118`). Yani
sistemde **"teslim ettim ama parayı almadım"** durumu TEMSİL EDİLEMİYOR.

Bu tek eksik şunları imkânsız kılıyor:

| Özellik | Neden kilitli |
|---|---|
| Tahsilat mutabakatı | "Şoför tahsil etti mi" sorusu sorulamıyor — cevap hep "evet" |
| Kurumsal cari | Ay sonu faturanın çekirdeği "teslim ettim, tahsil etmedim"tir |
| Ödeme linki | Link gönderilecek sipariş "zaten ödendi" görünüyor |

**Sonuç: sıralama değişti. Önce tahsilat gerçeği, sonra üstüne inşa.**

### 🔴 İkinci kök neden: KASA tahakkuk defteri, nakit defteri değil

`src/lib/ledger.ts:55-83` — sipariş geliri **LedgerEntry satırı olarak
YAZILMIYOR**, teslim edilmiş siparişlerden **canlı toplanıyor**. Yani
"tahsilatı kasaya otomatik düşür" diye satır yazılırsa **aynı para iki kez**
sayılır. Bu, en kolay yapılacak ve en sinsi hatadır.

---

## 1. SIRALAMA (gerekçeli)

| # | İş | Süre | Neden bu sırada |
|---|---|---|---|
| **1** | **Tahsilat gerçeği + gün sonu mutabakatı** | 2-3 gün | Diğer üç özelliğin ön şartı. Ucuz, riski düşük, halıcının en somut derdi |
| **2** | **Tip bazlı tarife + ölçüm/fiyat akışı** | 2-3 gün | Fiyat tartışmalarını bitirir; kurumsal carinin fiyat tarafını hazırlar |
| **3** | **Kurumsal cari + ay sonu fatura** | 8-12 gün | 1 olmadan yapılamaz. Fiyatı yükselten asıl özellik |
| **4** | **Halı etiketleme (QR)** | 1 hafta MVP / 2.5-4 hafta tam | En güçlü kilit ama en pahalı; kararlar gerekiyor (aşağıda) |
| **5** | **Ödeme linki (Model A)** | 1 gün "yapıştır" / 4-6 gün tam | Karar bekliyor: anahtar saklama riski |
| **6** | **Sezon hatırlatması** | 6-8 gün kod / **4-6 hafta canlı** | 🔴 Bugün **kendi sözleşmemizle yasak** (aşağıda) |

---

## 2. ŞİMDİ YAPILAN: TAHSİLAT GERÇEĞİ (Adım 1)

### Sorun

Bugün: teslim = ödendi. Gerçek: şoför parayı aldı ama halıcıya vermedi olabilir;
kurumsal müşteri ay sonu ödeyecek olabilir; müşterinin evde nakdi olmayabilir.

### Tasarım

**Yeni kavram: TAHSİLAT**, teslimden AYRI bir olay.

- `Order.collectedAmount` (Decimal?) — fiilen tahsil edilen tutar
- `Order.collectedAt` (DateTime?) — ne zaman
- `Order.collectedById` (String?) — kim tahsil etti (şoför veya halıcı)
- `Order.paymentStatus` artık **yalan söylemiyor**: nakit teslimde
  `PENDING` kalır, tahsilat işaretlenince `PAID` olur

**Şoför üzerinde bekleyen nakit** bir bayrak değil, bir **bakiyedir**:
şoför tahsil eder → bakiyesi artar → halıcıya teslim eder → bakiye kapanır.

- Yeni model `CashHandover` (şoför → halıcı nakit teslimi): driverId, amount,
  at, note. Gün sonu raporu: "Ahmet: 7 teslimat, 8.400 TL tahsilat,
  6.000 TL teslim etti, **2.400 TL üzerinde**"

### 🔴 Çift sayım tuzağı — nasıl kaçınılıyor

KASA'ya **INCOME satırı YAZILMAYACAK**. Kasa bugünkü gibi teslim edilen
siparişlerden canlı toplamaya devam eder. Mutabakat ekranı **ayrı bir
görünümdür** ve şunu net söyler:

> "Kasa **tahakkuk** gösterir (teslim ettiğin iş). Mutabakat **nakit**
> gösterir (elime geçen para). İkisi farklıysa fark, tahsil edilmemiş
> işlerdir."

İki rakam yan yana ama **etiketli** — halıcı hangisinin ne olduğunu bilir.

### Dosyalar

- `prisma/schema.prisma` — Order'a 3 alan + `CashHandover` modeli (katmerli)
- `src/app/panel/actions.ts` — `deliverOrderPanel` PAID zorlamasını bırakır
- `src/app/sofor/actions.ts` — aynısı (web şoför)
- `src/lib/driverOrders.ts` — aynısı (mobil uygulamanın sunucu tarafı)
- `src/lib/tahsilat.ts` (yeni) — gün sonu hesabı, şoför bakiyesi
- `src/app/panel/mutabakat/page.tsx` (yeni) — gün sonu ekranı
- `src/components/PanelNav.tsx` — menüye "Mutabakat"

⚠️ **ÜÇ İKİZ KURAL**: şoför akışı üç yerde yaşıyor. Biri unutulursa o yoldan
teslim edilen sipariş yine "ödendi" yazar. Üçü birlikte değişmeli.

⚠️ **MOBİL UYGULAMA**: `driver-app` versionCode 3 canlıda. Sunucu tarafı
değişikliği uygulamayı KIRMAZ (yalnız `paymentStatus` artık PENDING kalır),
ama şoförün "tahsil ettim" işaretini uygulamadan yapabilmesi için yeni sürüm
gerekir. Web şoför sayfası bugünden çalışır.

---

## 3. KARARA BAĞLI OLANLAR (işletme sahibi cevaplamadan başlanmaz)

### Halı etiketleme — 4 soru

1. **Kim okutacak?** Sistemde fabrika işçisi rolü YOK (`UserRole`: CUSTOMER,
   CLEANER, DRIVER, ADMIN, SUPPORT, ACCOUNTANT, AGENT). Banttaki işçi patronun
   hesabıyla mı girecek? O hesap Kasa'yı ve müşteri verisini görüyor — KVKK
   açısından kötü. Yeni bir `WORKER` rolü mü açılsın?
2. **iOS duvarı.** `BarcodeDetector` Android Chrome'da var, **iOS Safari'de
   yok** (iOS 26.5'te bile bayrak arkasında). iPhone'lu şoför için JS/WASM
   yedek kütüphane şart (~200 KB). Kabul mü?
3. **Etiket fiziksel olarak ne?** Halı ıslak. Termal kâğıt dağılır. Sektörde
   sentetik (PP/Tyvek) su geçirmez etiket kullanılıyor. **Etiket yazıcısı var mı,
   yoksa A4'e basılıp kesilecek mi?** Cevaba göre çıktı formatı değişir.
4. **Play Store döngüsü.** Okutma şoför işiyse mobil uygulamaya `expo-camera`
   eklenip yeni sürüm çıkacak: kod 1-2 gün, **inceleme 1-7 gün ve bizim
   kontrolümüzde değil.**

### Ödeme linki — 1 soru, ama büyük

`iyzipay` SDK'sında `iyziLink.create` HAZIR geliyor. Ama Model A'nın gerçek
maliyeti şu: **halıcının API anahtarını saklamak**, o hesabın TAMAMINI açmak
demektir — kart çekme, **iade yapma**, geçmiş tüm işlemleri listeleme.
34 halıcının anahtarı aynı veritabanında.

Üç seçenek:

| | Süre | Risk |
|---|---|---|
| **A1 "Yapıştır"** — halıcı linki kendi panelinden üretir, bize yapıştırır | 1 gün | Yok. Ama iyziLink sabit fiyatlı, her siparişin tutarı farklı → çalışmaz |
| **A2 "Anahtar bizde"** — halıcının API anahtarıyla link üretiriz | 4-6 gün | **Yüksek** — şifreleme, anahtar rotasyonu, sızıntıda 34 hesap |
| **B "iyzico Pazaryeri"** | Haftalar + başvuru | Lisanslı faaliyet; ayrıca "komisyonsuz" vaadini bozar |

**Önerim: hiçbiri, şimdilik.** Sipariş sayısı 15. Sıfıra yakın işlem hacmi için
34 halıcının ödeme anahtarını saklamak, taşınan riske değmez.

### Sezon hatırlatması — 🔴 bugün YASAK

Üç ayrı engel, üçü de gerçek:

1. **Kendi sözleşmemiz yasaklıyor.** `src/app/isletme-sozlesmesi/page.tsx:142-148`
   aynen: müşteri verisi "yalnızca ilgili siparişin ifası için" kullanılır,
   "pazarlama dâhil başka amaçla işlenemez". 34 işletme bunu onayladı.
   Değiştirmek = **30 gün önceden bildirim + yeniden onay** (`lib/legal.ts:13`).
2. **6563 sayılı kanun.** Sezon hatırlatması ticari elektronik iletidir;
   "onay gerektirmeyen haller" istisnasına GİRMEZ (istisna metni "mal veya
   hizmet özendirilemez" diyor). **İYS (İleti Yönetim Sistemi) kaydı zorunlu.**
   Tacir/esnaf istisnası var — otel, düğün salonu, ofis kapsamda; **ev müşterisi
   ve cami DEĞİL.**
3. **Meta tarafı.** Pazarlama şablonu UTILITY'den pahalı ve onayı zor;
   ayrıca hesap TIER_250 ve işletme doğrulaması hâlâ beklemede.

**Yapılabilir hali:** sistem otomatik GÖNDERMEZ. Panelde "geçen yıl bu ay
hizmet verdiklerin" listesi çıkar, halıcı **kendi WhatsApp'ından** tek tuşla
yazar. Hukuki sorumluluk halıcıda kalır, biz araç veririz. Bu, sözleşme
değişikliği de İYS kaydı da gerektirmez.

---

## 4. YAPILMAYACAKLAR (işletme sahibinin kararı, katılıyorum)

- **Native Android uygulaması** — tarayıcı şoför ekranı iş görüyor
- **Yeni pazaryeri özelliği** — talep tarafı hareketlenene kadar tek satır yok
- **Özellik şişkinliği** — panelde ZATEN 10 menü var. 50 yaşındaki kullanıcı
  için her yeni ekran engel. Yeni madde eklerken "ana ekran karışıyor mu?"
  sorusu her seferinde sorulacak

---

## 5. İŞLETME SAHİBİNİN ELİNDEKİ ASIL LİSTE

Bu plan tahmin; **16 halıcı gerçek**. Onlara "ne eksik?" diye sorulmaz, şu
sorulur:

> "Dün panelde yapamadığın için deftere yazdığın şey neydi?"

Deftere dönülen her nokta, sıradaki özelliktir — ve bu belgenin sırasını
değiştirebilir.
