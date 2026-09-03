# Halı Platform

> Bir halı yıkama pazar yeri: müşteri kendine yakın bir halıcıyı seçer, iş doğrudan o halıcının kendi şoförüne düşer, müşteri halısını adım adım takip eder.

**Canlı site:** https://enyakinhaliyikamaservisi.com · **English README:** [README.md](README.md)

![Next.js 15](https://img.shields.io/badge/Next.js-15-000000)
![React 19](https://img.shields.io/badge/React-19-087ea4)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)
![Expo](https://img.shields.io/badge/Expo-SDK%2052-000020)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ed)
![Lisans: AGPL v3](https://img.shields.io/badge/Lisans-AGPL%20v3-blue)

---

## Genel bakış

Türkiye'de halı yıkama, küçük dükkânların yürüttüğü bir mahalle işi. Koordinasyon telefonla ve defterle yapılıyor: müşteri arar, dükkân sahibi adresi bir yere yazar, şoförüne telefonda söyler, sonra haftanın kalanını *"halım nerede?"* sorusuna cevap vererek geçirir. Neredeyse hiçbir şey kayda geçmez — hangi halının kime ait olduğu da, şoförün gerçekte ne kadar nakit topladığı da, bir adreste ne kadar beklediği de.

Bu proje iki taraflı bir pazar yeri **artı** o dükkânın az önce aldığı işi yürütmek için ihtiyaç duyduğu arka ofis. Müşteri konumunu girer, o bölgeye hizmet veren halıcıları mesafe ve puana göre sıralı görür, sipariş verir ve bir takip bağlantısından süreci izler — `oluşturuldu → kabul edildi → alındı → yıkanıyor → teslimatta → teslim edildi` — alımda ve teslimde çekilen fotoğraflar hasar kanıtı olarak durur. Halıcı ise bir sipariş defteri, canlı şoför haritası, adres başına durak süreleriyle rota geçmişi, gün sonu nakit mutabakatı, gelir-gider defteri, müşteriye WhatsApp bildirimleri ve iyzico üzerinden faturalanan bir abonelik alır. Platform tarafında bir yönetim konsolu, yalnız mali müşavire açık bir görünüm ve o abonelikleri satan iki kademeli komisyoncu ağı var.

Tek kişi tarafından yazıldı ve işletildi; bir pilot halı yıkama işletmesi ve onun şoförleri için üretimde çalıştı. Depo sistemin tamamını içeriyor: Next.js web uygulaması, iki Expo/React Native uygulaması (müşteri ve şoför), dağıtım kurulumu ve sistemi ayakta tutan operasyon scriptleri.

### Bir bakışta kapsam

| | |
| --- | --- |
| Veritabanı | 33 Prisma modeli, 11 enum (~1.050 satırlık şema) |
| Web uygulaması | 63 sayfa, 53 API yolu, 16 server-action modülü |
| Alan mantığı | `src/lib` içinde 81 modül, 66 React bileşeni |
| Mobil | 2 Expo uygulaması — şoför (v1.2.8, versionCode 22) ve müşteri |
| Kontroller | 9 çalıştırılabilir doğrulama scripti (`npm run test:*`) |
| Boyut | `src/` altında ~53 bin satır TypeScript/TSX, iki uygulamada ~5,8 bin |

---

## Teknoloji

- **Web** — Next.js 15 (App Router, RSC, server actions), React 19, TypeScript 5.7, Tailwind, PWA manifest
- **Veri** — PostgreSQL 16 + Prisma 6, istek doğrulaması için Zod
- **Kimlik** — HMAC imzalı oturum jetonları (bcrypt ile parola özeti), hem çerezden hem `Bearer` başlığından kabul edilir; böylece panel mobil WebView içinde de çalışır
- **Ödeme** — iyzico: Checkout Form, abonelik ödemesi, tekrarlayan ödeme, abonelik webhook'u ve recurring callback
- **Mesajlaşma** — WhatsApp Cloud API (birincil kanal, gelen webhook'u ve uygulama içi gelen kutusuyla), SMTP e-posta, Expo Push → FCM, Netgsm/Twilio SMS
- **Harita ve rota** — varsayılan olarak Leaflet/OpenStreetMap, anahtar varsa Google Maps; yola oturtma ve rota için **kendi barındırdığımız OSRM**
- **Depolama** — AWS S3, geliştirme için yerel disk yedeğiyle
- **Mobil** — Expo SDK 52 / React Native 0.76, Android ön plan servisiyle `expo-location` arka plan görevi
- **Operasyon** — çok aşamalı Docker build, Docker Compose (geliştirme ve üretim), Caddy/nginx yapılandırmaları, yedekleme ve OSRM tazeleme cron scriptleri

---

## Özellikler

**Müşteri (web + Expo uygulaması)**
- Konuma göre keşif: müşterinin ilçesine hizmet veren halıcılar, mesafe ve puana göre sıralı, güven rozetleriyle — *alımda fotoğraf kaydı*, *zamanında teslim*, *yüksek puan* ve *hızlı yanıt* her gece gerçek sipariş verisinden yeniden hesaplanır ve dükkân koşulu kaybederse geri alınır; *doğrulanmış* rozeti elle verilir. Enum adı hâlâ `INSURED` olan rozet arayüzde **fotoğraf kaydı** diye etiketlenir ve bu bilinçlidir: gerçek bir poliçe yokken bir dükkâna "sigortalı" demek 6502 sayılı kanunun 61/62. maddeleri kapsamında yanıltıcı ticari uygulamadır, bu yüzden rozet vaat edileni değil **yapılanı** söyler
- Üyeliksiz sipariş; kısa bir takip kodu (`HLK-4F2A9`) ve jetonlu takip bağlantısı
- Kesin fiyat onayı: dükkân tutarı bildirir, müşteri kendi telefonundan onaylar ve onay kayda geçer
- Alım ve teslim fotoğrafları, teslimat sürerken canlı kurye konumu, teslim sonrası değerlendirme
- Organik erişim için SEO yüzeyi: il ve ilçe bazlı sayfalar, sitemap, robots

**Halıcı / dükkân sahibi (panel, 16 sayfa)**
- Tam durum makinesiyle sipariş defteri; kapıdan gelen müşteri için manuel kayıt — böylece sokak işi de aynı deftere düşer
- Şoför yönetimi ve mesai; canlı takip haritası; adres başına durak süreleriyle rota geçmişi
- **Gün sonu mutabakatı** — her şoförün ne teslim ettiği, ne tahsil ettiği, ne devrettiği ve üzerinde ne kaldığı
- **Kasa** — tekrarlayan kalemleri ve kâr/zarar özeti olan gelir-gider defteri
- "Halı Bul": dükkândaki halıların fotoğraf duvarı, her birine haftalık otomatik numara
- Her durum değişikliğinde müşteriye WhatsApp/e-posta bildirimi; cevaplar için mesaj gelen kutusu
- Yetkisi kısıtlı panelde çalışan hesapları — çalışan siparişi kaydeder ama ciroyu, IBAN'ı ve aboneliği görmez
- Abonelik: paket kartı, iyzico ödemesi, kart talimatı, yenileme hatırlatmaları, fatura bilgileri

**Şoför (Expo uygulaması + web)**
- Mesai aç/kapa, Android ön plan servisiyle arka plan konumu, gerekçeli kabul/ret
- Adım adım sipariş ilerletme, alım/teslim fotoğrafları, telefonun harita uygulamasına navigasyon devri
- Teslimde tahsilat beyanı (nakit / havale), bu beyan sahibin mutabakatını besler

**Platform (yönetim, komisyoncular, mali müşavir)**
- Yönetim: işletmeler, bölgeler, CSV çıktılı talepler, WhatsApp mesaj kaydı, sezonluk hatırlatma kontrolleri, aboneliklerin elden tahsili
- **Komisyoncu ağı**: iki kademe (baş komisyoncu → alt komisyoncu), komisyoncu başına oranlar, baş komisyoncunun dağıttığı komisyon havuzu, tavanlı indirim ve deneme süresi hakları, aylık otomatik üretilen ödeme talepleri, referans kodları ve kademeye göre görünürlüğü filtrelenen indirilebilir satış el kitabı
- Yalnız fatura verisine ve ödemelere erişen mali müşavir rolü
- Ortam değişkeninden gelen ticari kimlikle üretilen Türk hukuku yüzeyi (mesafeli satış sözleşmesi, ön bilgilendirme formu, KVKK metinleri, iade politikası, hesap silme) — `kunyeTamam()` kontrolü eksik bilgi varsa uydurmak yerine yer tutucu gösterir

---

## Mimari ve mühendislik kararları

### Sessiz bir üretim arızasını ayıklamak — konum bekçisi

`src/lib/konumBekcisi.ts` belirli bir olay yüzünden var ve başlığındaki yorum o olayın raporu.

Bir dükkân sahibi mesai açtı, uygulamada bir-üç dakika kaldı ve çıktı. Konum akışı telefon tarafından yaklaşık **6,5 dakika sonra** öldürüldü — arka plan işlerini öldürmekte en agresif üretici ailesi olan bir Transsion/HiOS cihazı — ve **iki saat boyunca kimse fark etmedi**. Sunucu tarafı temizdi: gelen her ping 200 dönüyordu. Panel yalnızca "aktif değil" diyor, sebebini söylemiyordu; şoför de mesaide olduğunu sanıyordu.

Çıkan kural: **bir akış öldüğünde bir insan bunu ekrandan görebilmeli.** Bekçi, ROM'un servisi öldürmesini engellemez; ölümü görünür kılar, marka fark etmeksizin çalışır ve pil muafiyeti akışı tutmasa bile sistemin kör kalmasını önler.

O dosyadaki her eşik tahminle değil, ölçülen veriyle gerekçelendirilmiştir:

- **10 dakika sessizlik = ölü akış.** Uygulama boştayken bile 60 saniyede bir kalp atışı gönderir, yani on dakika on kaçmış atıştır — geçici bir şebeke kesintisine takılmayacak kadar uzun.
- **12 saat sessizlik ölü akış değil, kapatılmayı unutulmuş mesaidir.** İlk çalıştırmada üretimde hâlâ açık beş mesai vardı, biri 22 Temmuz'dan beri. Bu tavan olmasaydı bekçi ilk tikinde her şoföre *ve* her sahibe alarm yağdırır, üstelik saat başı tekrarlardı. Onlarınki başka bir hataydı (mesai gün sonunda otomatik kapanmıyor) ve bir uyarıyla örtülmek yerine öyle kaydedildi.
- **Bekçi saat başı değil, 5 dakikada bir çalışır.** Ölçülen ölüm süresi ~6,5 dakikaydı; saatlik bir kontrol şoförü elli dakika kör bırakırdı.

İki gün sonra tasarım, kendi canlı ölçümlerine karşı düzeltildi. O ana kadar *"uygulamayı dirilt"* ile *"şoförü uyar"* **aynı bildirimdi**, dolayısıyla aynı 10 dakikalık eşiği ve aynı 60 dakikalık tekrar frenini miras alıyorlardı — yani ilk diriltme denemesi tutmazsa bir sonraki bir saat sonraydı. Tek bir şoförün bir günlük telemetrisi 12 delik gösterdi, ikisi 109 ve 114 dakika. Kodda birebir yazan sonuç:

> Deliğin büyük kısmı ROM'un bizi öldürmesi değildi — **bizim beklememizdi.**

İki işin ekonomisi farklı. Bir telefonu uyandırmak **bedavadır**: ekranda hiçbir şey görünmez, o yüzden sık yapılmalı. Bir insanı uyarmak **pahalıdır**: dikkatini harcar ve uyarılara olan güvenini aşındırır, o yüzden seyrek ve frenli olmalı. İkisini aynı takvime koymak tasarım hatasıydı. Artık ayrı tiklerde çalışıyorlar — 120 saniyelik sessizlik eşiğine karşı 15 saniyede bir sessiz uyandırma push'u, insana giden uyarı ise 5 dakikalık tikte.

Sessiz kanalın sonra geri çekilmesi gerekti. Önce "daha agresif daha iyidir" varsayımıyla 45 sn / 60 sn yapılmıştı; araştırma tersini gösterdi. FCM, kullanıcıya görünür bildirim üretmeyen yüksek öncelikli mesaj desenini tespit eder ve **o uygulamanın önceliğini düşürür**; ondan sonra mesajlar cihaz Doze'dan çıkana kadar bekletilir. Şoför başına saatte 60 sessiz push atmak, tasarımın dayandığı uyandırma kanalını tam da yakıyordu. Yerleşen değerler — 120 sn sessizlik, şoför başına 300 sn tekrar — kısma eşiğinin altında kalırken 109 dakikalık deliklere yol açan 60 dakikalık frenden yine on iki kat hızlı. Yorum, arkasındaki tekrar eden hata biçimini de adlandırıyor: *bir mekanizmanın neyi **kabul ettiğine** bakıp işin **olduğunu** varsaymak — Expo isteği kabul eder, FCM sessizce önceliği düşürür ve telefona hiçbir şey düşmez.*

Aynı dosyadaki iki küçük karar da anılmaya değer:
- **Toparlanma duyurulur.** Akış geri geldiğinde hem şoför hem sahip açıkça "yeniden çalışıyor" mesajı alır. İşareti sessizce silmek yetmez — alarmı alan iki kişi aksi hâlde hâlâ bozuk mu diye tahmin yürütür.
- **Uyarı şoföre ne yapacağını söyler**, yalnızca bir sorun olduğunu değil; ve `{ tip: "konum-yeniden-baslat" }` verisini taşır, böylece hâlâ çalışan bir uygulama şoför hiçbir şeye dokunmadan takibi yeniden başlatır.

Dürüst sınır uygulamada da yazılıdır (`driver-app/src/pil.ts`): pil optimizasyonu muafiyeti hayatta kalmayı *iyileştirir*, garanti etmez ve bazı üreticiler kendi ayarlarını yok sayar. Android `isIgnoringBatteryOptimizations` durumunu yalnız Expo'nun sarmaladığı bir API dışından verir; bu yüzden yalan söyleyecek bir kontrol yazmak yerine uygulama, şoförün beyanını dırdırı kesmek için saklar ve **asıl kanıtı** ayrıca gösterir: son başarılı konum gönderiminin zaman damgası.

### Para: birbirine asla karışmaması gereken iki defter

`src/lib/tahsilat.ts` gün sonu nakit mutabakatını hesaplar ve başlığı, yazılma sebebi olan tuzağı belgeler.

**Kasa** (`src/lib/ledger.ts`) bir **tahakkuk** defteridir: teslim edilmiş siparişlerin `priceTotal` toplamını anlık hesaplar, hiçbir satır yazmaz. Mutabakat ise **nakit** görünümüdür: sahibin eline gerçekte ne geçti. Mutabakattan Kasa'ya bir `INCOME` satırı yazmak aynı parayı iki kez sayardı ve dükkân sahibi "bu ay ne kazandım" sorusuna iki farklı cevap görürdü. İkisi ayrı ekranlarda, ayrı etiketlerle durur ve aralarında hiçbir şey geçmez.

İki ayrıntı daha taşıyıcıdır:
- **Havale nakitten ayrılır.** IBAN'a gelen para zaten işletme hesabındadır ve şoförün cebinde bir şey bırakmaz; "şoförde duran" bakiyesi yalnız nakit üzerinden işler. İkisini karıştırmak, sahibin şoförden hiç almadığı parayı istemesine yol açar.
- **O gün teslimi olmayan ama devri olan şoför yine de satır alır** — dün tahsil edip bugün devretmiş olabilir. Onu düşürmek, devri bakiyeden sessizce yok eder.

Modülün tamamı **saftır**: veritabanı yok, oturum yok, ortamdan gelen "şimdi" yok. Girdi girer, özet çıkar. `npm run test:tahsilat` komutunun Docker'sız ve veritabanısız çalışabilmesini sağlayan da budur — çünkü yorumun dediği gibi, para söz konusu olduğunda *"derlendi, herhâlde çalışıyordur"* yeterli değildir.

### Yalan söylemeden rota çizmek

Takip haritasında üç modül birlikte çalışır ve ortak kısıtları şudur: **harita, veriden daha emin olmamalı.**

- `src/lib/konumFiltre.ts` yalnızca **çizilen** diziyi süzer. Ham ping'ler dokunulmadan saklanır; bu hem delil değerini hem KVKK kaydını korur, dolayısıyla kötü bir süzgeç hiçbir veri kaybettirmez ve tek satırda geri alınabilir. Süzgeç zaman-farkındadır, çünkü ilk sürümü değildi: zaman damgası olmadan "yerinde durmak" ile "yavaş ilerlemek" ayırt edilemez, bu yüzden 60 m altındaki yavaş bir GPS sürüklenmesi kilometrelerce yol gibi çizilebiliyordu. Artık hıza göre karar verir (adım < 100 m **ve** < 0,7 m/sn ⇒ duruyor; ≥ 3 dakikalık duran adımlar tek noktaya iner) ve bir mesafe kapısıyla birlikte çalışır; böylece gece kapanıp 3 km ötede açılan bir uygulama, tek bir çok yavaş durak değil, hareket sayılır.
- `src/lib/yolaOturt.ts` izi **kendi barındırdığımız OSRM** üzerinden gerçek yollara oturtur, üç açık güvenlik kuralıyla: oturtma yalnız bir parçanın *içinde* yapılır, veri boşluğunun üzerinden asla; oturtulan yolun uzunluğu ham izden %40'tan fazla saparsa sonuç atılır; OSRM yavaşsa ya da erişilemezse ham iz çizilir. Gerekçe şu: yanlış bir sokak pürüzsüz çizildiğinde *"şoför oraya gitti"* diye okunur — yola oturtma yalanı **daha** inandırıcı yapar, o yüzden önce süzme gelmeli ve oturtmanın başarısız olabilmesine izin verilmelidir.
- `src/lib/tracking.ts` durak tespiti kurallarını tutar ve sınırları üretimde öğrenilmiştir: sınırsız bir ping boşluğunu emen bir durak, üstüne azami süresi olmayan bir durak, **37 saatlik bir "durak"** üretti (dükkânın kendi avlusunda park etmiş bir kamyonet) ve bu, sonraki günlerin raporlarını da boşalttı. Emilen boşluk artık 1 saatle, tek bir durak 12 saatle sınırlı.

Rota motoru `scripts/osrm-tazele.sh` ile aylık cron'da tazelenir: Türkiye yol verisini **ayrı** bir dizine yeniden kurar, tek kullanımlık bir konteynerde duman testinden geçirir ve ancak ondan sonra canlı servisi ona çevirir. Herhangi bir adımdaki başarısızlık eski veriyi hizmette bırakır ve mail atar.

### Sağlayıcı dikişleri ve açılmayı reddeden bir yapılandırma kapısı

Ödeme, SMS, e-posta, depolama ve harita — her biri, ortam değişkeniyle seçilen bir mock ve bir canlı uygulamanın arkasında durur. Sistemin hiçbir yerde hesap açmadan geliştirilebilmesini sağlayan budur; ama üretimde bir mock, çökmekten daha kötüdür. Bu yüzden `validateConfig()`, `NODE_ENV=production` iken şu durumlarda sunucuyu başlatmayı reddeder: oturum anahtarı kısaysa ya da yer tutucuysa, temel URL localhost ise, ödemeler canlıyken iyzico anahtarları yoksa, iyzico temel URL'si hâlâ sandbox'ı gösteriyorsa ya da fotoğraf depolaması yapılandırılmamışsa — ya S3 anahtarları olacak, ya da kalıcı diski olan bir makine için bilinçli bir `ALLOW_LOCAL_UPLOADS=1` tercihi, çünkü konteyner dosya sistemi kalıcı değildir. `iyzico.ts` mock'a düşmek yerine kurulum anında hata fırlatır, çünkü sessiz bir geri düşüş, paranın hiç alınmaması ama siparişin yine de "ödendi" demesi anlamına gelir.

### Kapalıya düşen yetkilendirme

`src/lib/panelYetki.ts` paneli dükkân çalışanlarına açarken sahibe özel yolu zayıflatmaz. `getCurrentBusiness()` **değiştirilmeden bırakıldı** — hâlâ yalnız `role === "CLEANER"` kabul ediyor — böylece onu çağıran ~25 yerin hepsi hiçbir düzenleme olmadan sahibe özel kaldı ve çalışan erişimi tek tek, çağrı yeri bazında açılıyor. Tersi (izin veren ortak bir fonksiyon artı hassas sayfalarda korumalar) unutulan her çağrı yerini bir sızıntıya çevirirdi.

Koruma ayrıca herhangi bir Prisma sorgusundan **önce** çalışmak zorunda. App Router'da bir layout ile onun sayfası paralel render edilir, dolayısıyla layout seviyesindeki bir `redirect()` sayfanın sorgusunun çalışmasını ve verisinin RSC yüküne ulaşmasını engellemez. Bu yüzden kısıtlı her sayfa korumasını ilk satırda çağırır. Aynı kural `paketYetki.ts` içindeki abonelik kademesi kapısını da yönetir: plan *ve* dönem geçerliliğini tek bir fonksiyonda okur, böylece "ödemeyi kesen işletme silinmez, kademesi düşer" kuralı tam olarak tek bir yerde yaşar.

### Geri çağrıların tekrarlandığı yerde idempotentlik

Ödeme geri çağrıları, webhook'lar ve arka plan tikleri birden fazla kez tetiklenir; bu yüzden garantiler şemada ve sorgunun biçimindedir:

- `CommissionEntry.paymentId` alanı `@unique`'tir; bu, tekrarlanan bir webhook'u çift tahakkuk yerine sessiz bir işlemsizliğe (P2002) çevirir ve komisyon tahakkuku best-effort çağrılır, böylece bir başarısızlık ödeme kaydını asla geri almaz.
- Mobil devir nonce'u (`src/app/m/[nonce]/route.ts`) `delete` ile tüketilir — silme işleminin kendisi *taleptir*. Yarışan iki istek demek, tam olarak bir kazanan demektir; `findUnique` sonrası `delete` bunu vermezdi.
- Günlük tik, oku-sonra-yaz yerine bir `AppState` satırı üzerinde atomik `UPDATE ... WHERE value <> bugün` kullanır, çünkü konteyner günde birkaç kez yeniden başlar (deploy, OOM) ve "açılışta bir kez + 24 saatlik aralık" deseni müşteriye iki kez mesaj atardı. Ekleme yolu create/catch yerine `createMany({ skipDuplicates })` kullanır, böylece kaybedilen bir yarış, konteyner logunda gerçek hataları maskeleyen bir Prisma tekillik ihlali basmaz.
- Zamanlayıcılar aralığın yanı sıra açılıştan sonra bilinçli bir gecikmeyle de başlatılır, çünkü aralık sayacı her yeniden başlatmada sıfırlanır — bir düzine deploy yapılan bir günde kontrol hiç çalışmayabilirdi.

### Dağıtım

Dockerfile, root olmayan bir kullanıcıyla çalışan bir Next.js standalone çıktısı üreten üç aşamalı bir build'dir. `NEXT_PUBLIC_*` değerleri build argümanı olarak geçirilir, çünkü `.env` bilinçli olarak `.dockerignore` içindedir ve bu değerler derleme anında istemci paketine gömülür. Server Action şifreleme anahtarı build'ler arasında sabitlenir, böylece action kimlikleri değişmez ve yeniden dağıtım, birinin açık bıraktığı sekmedeki formu bozmaz. Üretim compose dosyası Postgres'i host ağından tamamen uzak tutar, çalıştığı makineye göre ayarlar ve yüklemeleri adlandırılmış bir volume'de saklar.

### Veri koruma

Saklama süresi yalnızca politika sayfalarında vaat edilmez, uygulanır: ham konum ping'leri 30 gün sonra budanır; gizlilik metninin ve şoför aydınlatmasının 12 ay sonra silineceğini taahhüt ettiği durak kayıtları günlük bir tikte temizlenir. Silme parçalı yapılır ve açılış yolundan çıkarılmıştır (`await` değil `void`), çünkü bir kesinti sonrası biriken iş, öncelik siteyi ayağa kaldırmakken açılışı dakikalarca bloke edebilirdi. Testler için depoya konan örnek konum izi (`scripts/veri/konum-ornek.json`) anonimleştirilmiştir: boylamlar kaydırılmış, saatler yeniden tabanlandırılmış, tüm göreli geometri korunmuştur.

---

## Başlarken

Node.js 22+ ve Docker gerekir.

```bash
# 1) Veritabanı (Postgres, Docker ile)
docker compose up -d db

# 2) Bağımlılıklar
npm install

# 3) Yapılandırma — şablonu kopyala ve başlıktaki yorumları oku;
#    her sağlayıcı varsayılan olarak mock, yani dışarıdan hiçbir şey gerekmez
cp .env.example .env

# 4) Şemayı uygula
npm run db:push

# 5) İsteğe bağlı: demo veri
npm run db:seed

# 6) Geliştirme sunucusu
npm run dev          # http://localhost:3000
```

Tam konteyner çalıştırma (uygulama + veritabanı):

```bash
docker compose up --build
```

Doğrulama scriptleri — ekrana bakarak kontrol edilemeyen para ve konum kuralları. Hiçbiri veritabanı istemez:

```bash
npm run test:tahsilat   # gün sonu nakit mutabakatı
npm run test:konum      # konum izi süzme (sentetik + anonimleştirilmiş gerçek iz)
npm run test:durak      # durak tespiti
npm run test:fiyat      # abonelik fiyat merdiveni
npm run test:para       # para ayrıştırma/biçimleme
npm run test:paket      # abonelik kademesine göre modül kilidi
npm run test:halino     # haftalık halı numarası
npm run test:rehber     # komisyoncu el kitabı üretimi + kademe görünürlüğü
npm run test:odeme      # ödeme zinciri: ekrandaki tutar ↔ iyzico planı (para hareket ettirmez)
```

`test:odeme`, dışarıya erişim isteyen tek istisnadır: iyzico'daki canlı plan tanımlarını okuyup fiyat kodunun üretebileceği her tutarın karşılığında etkin bir plan olduğunu doğrular, bu yüzden kabukta iyzico kimlik bilgileri ister. Hiçbir zaman para hareket ettirmez.

İki Expo uygulaması `driver-app/` ve `customer-app/` altındadır ve her biri `EXPO_PUBLIC_API_BASE` değişkenine göre derlenir; kendi README'lerine bakın.

`.env.example` her anahtarı belgeler; `NODE_ENV=production` altında hangilerinin zorunlu hâle geldiğini ve nedenini de içerir.

---

## Bilinen sınırlamalar

Dürüst liste; hepsi kodda görünür ve çoğu orada da not düşülmüştür.

- **Tek örnek varsayımları.** Hız sınırlayıcı (`src/lib/ratelimit.ts`) bellek içi sabit pencere, uyandırma tiki şoför başına bekleme süresini süreç-yerel bir `Map` içinde tutuyor ve ping budama her örnekte fırsatçı çalışıyor. Bunu yatay ölçeklemek paylaşılan bir depo (Redis) ve gerçek bir iş koşucusu gerektirir; kod bunu her yerde söylüyor.
- **Arka plan işleri web sürecinin içinde çalışıyor.** Zamanlama, bir kuyruk ya da worker'da değil, `src/instrumentation.ts` içinde `setInterval` ile. Günlük iş, atomik bir `AppState` bayrağıyla çift çalışmaya karşı korunuyor ama tasarım tek-makine tasarımıdır.
- **Şema, konteyner açılışında `prisma db push --accept-data-loss` ile uygulanıyor**, sürümlü migration'larla değil. O bayrak zorunlu, çünkü gözetimsiz bir `db push` aksi hâlde onay bekleyip bloke oluyor ve uygulama hiç açılmıyor — bu, 2026-07-09'da bir `@unique` kısıtı eklendiğinde üretimde kesintiye yol açtı. Sürüm geçmişi gereken herhangi bir dağıtım `prisma migrate deploy` kullanmalı.
- **Test koşucusu yok, CI yok.** Yukarıdaki kontroller saf fonksiyonlar üzerine elle yazılmış doğrulama scriptleri. Bileşen testi yok, uçtan uca kapsam yok; API yolları ve server action'lar hiç kapsanmıyor — elle doğrulandılar.
- **Pil optimizasyonu durumu okunamıyor.** Expo bunun için bir API sunmuyor, bu yüzden şoför uygulaması şoförün kendi beyanını saklıyor ve asıl kanıt olarak son başarılı gönderimi gösteriyor. Uydurma bir kontrol açıkça reddedildi.
- **Abonelik kademesi kapısı pratikte hiç tetiklenmedi.** Üretimdeki her abonelik en üst kademedeydi, dolayısıyla hiçbir modül kilitlenmedi. Katman, yazıldığı fiyat geçişinden önce bilerek kuruldu ve fiyat merdiveninin kendisi hâlâ `FIYAT_MERDIVENI` bayrağının arkasında.
- **Müşteri telefon numaraları normalleştirilmeden saklanıyor**, bu yüzden gelen WhatsApp eşleştirmesi birkaç biçimi deniyor ve Türkiye dışı numaraları hiç eşleştirmiyor — yönetim gelen kutusunda eşleşmemiş bir mesaj, yanlış siparişe iliştirilmiş bir mesajdan iyidir. Doğru düzeltme yazma anında normalleştirmektir ve yapılmadı.
- **SMS kapalı geliyor.** WhatsApp maliyet gerekçesiyle birincil kanal oldu, dolayısıyla Netgsm/Twilio yolu yazıldı ve loglanıyor ama hiçbir zaman canlı kanal olmadı.
- **Sezonluk hatırlatmalar varsayılan olarak kapalı.** Türk hukukunda ticari elektronik ileti sayılırlar (6563/İYS) ve sorumluluk onları açan kişidedir, bu yüzden varsayılan-açık bir yol yok.
- **Mesai gün sonunda otomatik kapanmıyor.** Bekçi bunu alarm vermek yerine 12 saatlik terk tavanıyla dolanıyor; asıl düzeltme proje durduğunda hâlâ açıktı.
- **Takip haritasının OSRM bağımlılığı isteğe bağlı ama yönetilmiyor** — compose dosyasının dışında, bir cron scriptiyle tazelenen ayrı bir konteyner olarak çalışıyor, dolayısıyla yeni bir klon o kurulana kadar oturtulmuş değil ham iz görür.

---

## Durum

**Kapatıldı.** Platform, **bir pilot halı yıkama işletmesi** ve onun şoförleri için üretimde çalıştı; ikinci bir ödeyen dükkâna hiç ulaşmadı. İki mobil uygulama da EAS ile derlenip dağıtıldı — şoför uygulaması gerçek saha kullanımının yönlendirmesiyle 1.2.8 sürümüne (versionCode 22) ulaştı — ve Play Store kapalı test kanalına hazırlandı.

Bir **referans uygulaması** olarak yayımlanıyor: demo değil, tamamlanmış ve dağıtılmış bir sistem; üretimde yaşanan olaylar, ölçümleri ve her düzeltmenin gerekçesi, gerçekleştikleri yerde kod yorumlarında bırakıldı. Ticari belgeler, sözleşmeler ve kişisel veriler yayımdan önce çıkarıldı; kod tabanındaki satır içi yorumlar Türkçedir.

---

## Lisans

AGPL-3.0 — bkz. [LICENSE](LICENSE).

AGPL bilinçli bir tercih. Bu, yayımlanmak için yazılmış bir öğretici örnek değil; gerçek sipariş ve gerçek para almış bir ticari servisin kodu, sonradan okunabilsin diye yayımlandı. Herkes inceleyebilir, değiştirebilir ve çalıştırabilir — ama değiştirilmiş bir sürümü ağ üzerinden servis olarak çalıştırmak, o sürümün kaynağını yayımlamak demektir. Telif yazarda olduğu için ayrı ticari şartlar talep üzerine düzenlenebilir.
