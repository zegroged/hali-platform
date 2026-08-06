# PLAY MAĞAZA METİNLERİ — KOPYALA/YAPIŞTIR (2026-08-06)

> Bu dosya **TEK KAYNAKTIR.** `STORE.md` §4'teki metinler BAYAT
> (*"Bu uygulama şoförler içindir… Müşteriler web sitesini kullanır"* —
> 1.1.x'te işletme, çalışan ve komisyoncu da giriyor, o beyan YANLIŞ olurdu).
> DEVIR 4.60/f2 "metinler bu maddede" diyordu ama metinler oraya hiç
> yazılmamıştı — bu dosya o boşluğu kapatıyor.
>
> ⚠️ **Rol sayısı 2026-08-06'da 3'ten 4'e çıktı** (çalışan paneli, bkz. 4.61a).
> Metin bunu anlatıyor. Rol eklenirse burayı da güncelle.

---

## Uygulama adı (≤30)

```
En Yakın Halı Yıkama İşletme
```
(28 karakter)

---

## Kısa açıklama (≤80)

```
Halı yıkama işletmeleri ve şoförleri için sipariş, mesai ve canlı konum.
```
(72 karakter)

---

## Tam açıklama (≤4000)

```
En Yakın Halı Yıkama — İşletme Uygulaması

Bu uygulama, enyakinhaliyikamaservisi.com platformuna kayıtlı halı yıkama
işletmeleri ve onların ekipleri içindir. Tek giriş ekranından dört rol girer;
hesabın hangi role aitse uygulama seni doğrudan kendi ekranına götürür.

İŞLETME SAHİBİ
• Gelen siparişleri gör, kabul et veya reddet
• Kapıdan gelen müşteriyi elle kaydet
• Halıyı ölçüp kesin fiyatı bildir — müşteriye onay bildirimi gider
• Şoförlerinin nerede olduğunu canlı haritada izle
• Kasa, aylık ciro ve raporlar
• Abonelik ve ödeme işlemleri

DÜKKÂN ÇALIŞANI
• Siparişleri yönet, yeni kayıt aç, halı fotoğrafı yükle
• "Halı Bul" ile elindeki halının kime ait olduğunu fotoğrafından bul
• Kasa, ciro, abonelik ve ödeme bilgileri çalışan hesabına KAPALIDIR

ŞOFÖR
• Tek dokunuşla mesaiye başla / bitir
• Sana atanan işleri gör, adrese yol tarifi al
• Halıyı alırken ve teslim ederken fotoğraf çek — hasar ve kayıp kanıtı
• Kaç halı aldığını gir, halı numaraları otomatik oluşsun

KOMİSYONCU
• Platforma kazandırdığın işletmeleri ve kazançlarını takip et

KONUM KULLANIMI
Şoför "Mesaiye Başla" dediğinde uygulama; kapalıyken veya arka plandayken bile
konumu toplar ve yalnızca şoförün bağlı olduğu halı yıkama işletmesiyle
paylaşır. Böylece müşteri "halım nerede?" sorusunun cevabını canlı haritada
görür. Mesai bittiğinde konum paylaşımı tamamen durur.

Konum verisi yalnız sipariş takibi ve rota kaydı için kullanılır, üçüncü
taraflarla paylaşılmaz. 12 ayı aşan konum ve durak kayıtları otomatik silinir.

GİRİŞ BİLGİLERİ
Şoför ve çalışan; kullanıcı adı ile şifresini çalıştığı halı yıkama
işletmesinden alır. İşletme sahibi, platforma kaydolurken belirlediği
bilgilerle girer.

Müşteriler sipariş vermek ve halılarını takip etmek için
enyakinhaliyikamaservisi.com adresini kullanır — bu uygulamaya ihtiyaçları
yoktur.

Gizlilik politikası: enyakinhaliyikamaservisi.com/gizlilik
```

---

## Doldurulmayacak alanlar (isteğe bağlı — BOŞ BIRAK)

Chromebook · Android XR · XR videoları · YouTube video bağlantısı ·
10 inçlik tablet ekran görüntüsü (2 telefon karesi o alanı kapatır).

## Zorunlu görseller

| Alan | Dosya |
|---|---|
| Uygulama simgesi 512×512 | `driver-app/store-assets/play-icon-512.png` |
| Öne çıkan grafik 1024×500 | `driver-app/store-assets/feature-graphic-1024x500.png` |
| Telefon ekran görüntüsü (en az 2) | `node scripts/play-ekran.mjs "<klasör>"` ile 1080×1920'ye çevir |
