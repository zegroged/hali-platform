import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { API_BASE, panelBaglantisi } from "./api";

// İŞLETME / KOMİSYONCU EKRANI (2026-08-04).
//
// KARAR: bu roller için native ekran YAZILMADI, panelin kendisi uygulamanın
// içine gömüldü. Gerekçe:
//  - Özellik eşitliği anında tam: kesin fiyat, Halı Bul, Kasa, Mesajlar,
//    rehberler, demo paneli… hepsi ilk günden çalışıyor.
//  - Panelde çıkan her yeni özellik telefonda da görünüyor; Play'e YENİ SÜRÜM
//    göndermek gerekmiyor (işletme sahibinin en çok istediği şey buydu).
//  - Panel zaten mobil ölçülerine göre düzeltildi (taşma turları).
// Şoför akışı NATIVE kalıyor: arka plan konumu, kamera ve bildirimler
// tarayıcıda güvenilir çalışmaz.

type Props = {
  /** Oturum kapandığında (panelden çıkış) uygulamayı da çıkart. */
  onLogout: () => void;
  /** Oturum düştüğünde (panel /giris'e attı) uygulamayı giriş ekranına al. */
  onSessionLost: () => void;
};

export function Panel({ onLogout, onSessionLost }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const webRef = useRef<WebView>(null);
  const geriGidebilir = useRef(false);

  const baglantiAl = useCallback(async () => {
    setHata(null);
    setYukleniyor(true);
    try {
      setUrl(await panelBaglantisi());
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Panel açılamadı");
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    baglantiAl();
  }, [baglantiAl]);

  // Android geri tuşu: panelde bir sayfa geri git; başlangıçtaysak uygulamadan
  // çıkmak yerine hiçbir şey yapma (kullanıcı yanlışlıkla kapatmasın).
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (geriGidebilir.current) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={s.wrap}>
      {/* ÜST ŞERİT KALDIRILDI (2026-08-06, cihazda görüldü): panelin kendi
          başlığı (işletme adı + bildirim zili + Çıkış) zaten var; üstüne bir de
          native şerit koyunca ekranda İKİ AYRI "Çıkış" düğmesi oluşuyordu ve
          hangisinin ne yaptığı belirsizdi. Şerit kaldırıldı — panel tam ekran,
          çıkış tek yerden (panelin kendi düğmesi).
          ⚠️ Panelden çıkış yapılınca panel /giris'e gider; aşağıdaki
          onNavigationStateChange bunu yakalayıp uygulamanın oturumunu da
          KAPATIR. Yoksa web tarafı çıkmış, uygulama hâlâ girişli kalırdı. */}
      {hata ? (
        <View style={s.merkez}>
          <Text style={s.hata}>{hata}</Text>
          <TouchableOpacity style={s.btn} onPress={baglantiAl}>
            <Text style={s.btnText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : url ? (
        <WebView
          ref={webRef}
          source={{ uri: url }}
          // Oturum çerezi WebView'in kavanozunda kalsın (iOS paylaşımlı çerez).
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          // HIZ (2026-08-05, kullanıcı: "kasıyordu, yavaştı"). Varsayılan
          // WebView yazılım katmanında çizer; uzun listelerde kaydırma takılır.
          // `hardware` GPU'ya alır — panelin sipariş/mesaj listeleri akıcılaşır.
          androidLayerType="hardware"
          // 🔴 YAKINLAŞTIRMA KİLİDİ (2026-08-07 akşam — ekran görüntüsüyle
          // teşhis edildi). İşletme sahibi: *"WhatsApp panelinin boyutları
          // yanlış, yazılar sağa kayıyor."* İki ekran görüntüsü yan yana
          // konunca görüldü ki DÜZEN BOZUK DEĞİL: sayfa YAKINLAŞTIRILMIŞ
          // durumda kalmış — yazılar büyük, sağ kenar (tarihler) kesilmiş,
          // alt sekme çubuğu ekran dışında. Web tarafında 375 px'te ölçüm
          // yapıldı, taşma YOKTU; sebep buymuş.
          // Android WebView'de kıstırma-yakınlaştırma VARSAYILAN AÇIK; kaydırma
          // sırasında kazara iki parmak değince sayfa yakınlaşıyor ve o hâlde
          // KALIYOR. Panel zaten telefon ölçüsüne göre yapıldığı için
          // yakınlaştırmanın bir faydası yok, tek etkisi bu arıza.
          // ⚠️ ERİŞİLEBİLİRLİK KAYBI YOK: WebView sistem yazı boyutu ölçeğini
          // uygulamaya devam eder — büyük yazı isteyen telefon ayarından büyütür.
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
          // 🔴 SİSTEM YAZI ÖLÇEĞİNİ UYGULAMA (2026-08-07 gecesi).
          // İşletme sahibi 1.1.8'den sonra da *"kartlar büyük, çıkış yazısına
          // oranlasana"* dedi. Yakınlaştırma kilidi kıstırmayı kapatıyor ama
          // Android WebView ayrıca **sistem yazı boyutu ölçeğini** uyguluyor
          // (Ayarlar → Ekran → Yazı tipi boyutu). Telefonda büyük yazı seçiliyse
          // panelin YAZILARI büyüyor, kutu ölçüleri büyümüyor → kartlar şişiyor
          // ve satırlar taşıyor. Web'de 360 px'te ölçüldü: taşma YOK, yani
          // sorun sayfada değil bu ölçekte.
          // `textZoom={100}` paneli tasarlandığı ölçekte çizer.
          // ⚠️ Erişilebilirlik: yazıyı büyütmek isteyen için telefonun kendi
          // yakınlaştırma (büyüteç) özelliği duruyor; panelin kendi ölçüsü
          // zaten telefon için tasarlandı.
          textZoom={100}
          cacheEnabled
          // Sayfa sonunda zıplama efekti mobil web'de "bozuk" hissi veriyordu.
          overScrollMode="never"
          // Panel yeni pencere açmıyor; kapatmak gereksiz köprüyü kaldırır.
          setSupportMultipleWindows={false}
          // Aşağı çekip yenileme — panelde F5 karşılığı.
          pullToRefreshEnabled
          // Dosya seçici (fotoğraf yükleme) panelde de çalışsın.
          allowsInlineMediaPlayback
          originWhitelist={["https://*"]}
          onLoadEnd={() => setYukleniyor(false)}
          onNavigationStateChange={(n) => {
            geriGidebilir.current = n.canGoBack;
            // Oturum düştüyse panel /giris'e atar. Kullanıcıyı web formunda
            // bırakmak yerine uygulamanın kendi giriş ekranına döndürüyoruz —
            // yoksa iki ayrı giriş ekranı olurdu.
            if (n.url.startsWith(`${API_BASE}/giris`)) {
              // Panelden çıkış yapıldı ya da oturum düştü: uygulamanın
              // jetonunu da temizle, yoksa bir dahaki açılışta kendiliğinden
              // geri girer ve "çıkış yaptım" hissi yalan olurdu.
              onLogout();
              onSessionLost();
            }
          }}
          onError={() =>
            setHata("Bağlantı kurulamadı. İnternetini kontrol et.")
          }
          renderError={() => (
            <View style={s.merkez}>
              <Text style={s.hata}>Sayfa yüklenemedi.</Text>
            </View>
          )}
        />
      ) : null}

      {yukleniyor && (
        <View style={s.yukleniyor} pointerEvents="none">
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  rol: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  cikis: { paddingHorizontal: 12, paddingVertical: 8 },
  cikisText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  merkez: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  hata: { fontSize: 15, color: "#b91c1c", textAlign: "center", marginBottom: 16 },
  btn: {
    backgroundColor: "#0f766e",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  yukleniyor: {
    ...StyleSheet.absoluteFillObject,
    top: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.75)",
  },
});
