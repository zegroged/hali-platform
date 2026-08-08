import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  login,
  getToken,
  getRole,
  logout,
  setShift,
  oturumTazele,
  API_BASE,
  type Rol,
} from "./src/api";
import {
  startTracking,
  stopTracking,
  isTracking,
  konumIzniVarMi,
  sonKonumGonderimi,
} from "./src/tracking";
import { ensureNotifPermission, pushKaydet, pushSil } from "./src/notify";
import {
  pilMuafiyetiIste,
  uygulamaAyarlariniAc,
  pilUyarisiGosterildiMi,
  pilUyarisiniIsaretle,
} from "./src/pil";
import { Orders } from "./src/Orders";
import { Panel } from "./src/Panel";

const NAME_KEY = "hali_driver_name";
const PAKET = "com.enyakinhaliyikamaservisi.driver";

/**
 * PİL KISITLAMASI UYARISI — mesai ilk kez açıldığında bir kez.
 *
 * Gerekçe (2026-08-08 ölçümü): Tecno'da konum akışı mesai açıldıktan ~6,5 dk
 * sonra ölüyordu; sebep telefonun ön plan servisini öldürmesiydi. Uygulamanın
 * o güne kadar şoförü ayara GÖTÜREN hiçbir yolu yoktu — yalnız "Ayarlar'dan
 * yap" yazıp bırakıyordu, sahada kimse yapmaz.
 */
function pilUyarisiniGoster(): Promise<"muafiyet" | "ayarlar" | "sonra"> {
  return new Promise((resolve) => {
    Alert.alert(
      "Konumun kesintiye uğramasın",
      "Bazı telefonlar ekran kapalıyken uygulamayı durdurur ve konumun " +
        "işletmene GİTMEZ — sen mesaide sanırsın. Bunu önlemek için " +
        "“Halı Şoför”ü pil kısıtlamasından çıkar.",
      [
        { text: "Sonra", style: "cancel", onPress: () => resolve("sonra") },
        { text: "Diğer ayarlar", onPress: () => resolve("ayarlar") },
        { text: "İzin ver", onPress: () => resolve("muafiyet") },
      ],
      { cancelable: true, onDismiss: () => resolve("sonra") },
    );
  });
}

/** Panel şeridinde gösterilecek rol adı. */
const ROL_ADI: Record<string, string> = {
  CLEANER: "İşletme paneli",
  STAFF: "Çalışan paneli",
  AGENT: "Komisyoncu paneli",
  ADMIN: "Yönetim",
  SUPPORT: "Müşteri hizmetleri",
  ACCOUNTANT: "Muhasebe",
  CUSTOMER: "Hesabım",
};
const PRIVACY_URL = "https://enyakinhaliyikamaservisi.com/gizlilik";

/**
 * Google Play "prominent disclosure": arka plan konum İZNİ İSTENMEDEN ÖNCE
 * ne toplandığı, ne zaman ve kiminle paylaşıldığı açıkça söylenip onay alınır.
 * Kullanıcı vazgeçerse izin isteği HİÇ tetiklenmez (politika gereği).
 */
function askLocationDisclosure(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Konum paylaşımı",
      "Mesaiye başladığında bu uygulama, uygulama kapalı veya arka plandayken " +
        "bile konumunu toplar ve bağlı olduğun halı yıkama işletmesiyle paylaşır. " +
        "Konum yalnız sipariş takibi ve rota kaydı için kullanılır; mesaiyi " +
        "bitirdiğinde paylaşım tamamen durur.",
      [
        { text: "Vazgeç", style: "cancel", onPress: () => resolve(false) },
        { text: "Kabul et ve başla", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function Driver() {
  const [authed, setAuthed] = useState(false);
  // ROL (2026-08-04): tek giriş ekranı, rol sunucudan gelir — sitedeki /giris
  // gibi. DRIVER native ekranlara, diğerleri gömülü panele düşer.
  const [role, setRole] = useState<Rol | null>(null);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [onShift, setOnShift] = useState(false);
  /**
   * 🔴 KONUM AKIŞI GÖSTERGESİ (2026-08-07 gecesi).
   * Konum gönderiminin ölmesi bugüne kadar HİÇBİR YERDE görünmüyordu: şoför
   * "mesaideyim" sanıyor, halıcı boş harita görüyordu (canlıda yaşandı —
   * 2 saatte 33 sipariş isteği, SIFIR konum). Artık ekran söylüyor.
   */
  const [konumYasiSn, setKonumYasiSn] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const oturumVar = !!(await getToken());
      setAuthed(oturumVar);
      setRole(await getRole());
      if (oturumVar) {
        pushKaydet().catch(() => {});
        // OTURUMU TAZELE: jeton geçerliyse süresi sıfırlanır (aktif kullanan
        // hiç çıkış yapmaz), ölmüşse giriş ekranına düşeriz. Ağ yoksa
        // `undefined` döner ve mevcut oturumla devam edilir.
        const rol = await oturumTazele();
        if (rol === null) {
          setAuthed(false);
          setRole(null);
        } else if (rol) {
          setRole(rol);
        }
      }
      setOnShift(await isTracking());
      // Ad kalıcı: uygulama yeniden açılınca başlık "Şoför"e düşmesin.
      const savedName = await AsyncStorage.getItem(NAME_KEY);
      if (savedName) setName(savedName);
    })();
  }, []);

  async function doLogin() {
    setBusy(true);
    try {
      const d = await login(identifier.trim(), password);
      setName(d.name);
      await AsyncStorage.setItem(NAME_KEY, d.name);
      setRole(d.role);
      setAuthed(true);
      // Bildirim jetonunu giriş SONRASI kaydet (Bearer gerekiyor).
      pushKaydet().catch(() => {});
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  }

  // Mesai açıkken 15 sn'de bir "en son ne zaman konum gitti" hesapla.
  useEffect(() => {
    if (!onShift) {
      setKonumYasiSn(null);
      return;
    }
    const hesapla = () => {
      const t = sonKonumGonderimi();
      setKonumYasiSn(t === 0 ? -1 : Math.round((Date.now() - t) / 1000));
    };
    hesapla();
    const id = setInterval(hesapla, 15000);
    return () => clearInterval(id);
  }, [onShift]);

  async function toggleShift() {
    setBusy(true);
    try {
      const next = !onShift;
      if (next) {
        // Play politikası: izin isteğinden ÖNCE belirgin açıklama + onay.
        // AMA YALNIZ BİR KEZ (2026-08-06): izin zaten verilmişse yeni izin
        // isteği tetiklenmiyor, dolayısıyla açıklamayı tekrar göstermek
        // gereksiz — şoför her mesai açışında aynı metni okumak zorunda
        // kalıyordu. İzin yoksa akış eskisi gibi: önce açıklama, sonra istek.
        const izinVar = await konumIzniVarMi();
        if (!izinVar) {
          const accepted = await askLocationDisclosure();
          if (!accepted) return;
        }
        const err = await startTracking();
        if (err) {
          Alert.alert("İzin gerekli", err);
          return;
        }
        // Yeni-iş bildirimi izni (Android 13+): mesai bağlamında iste —
        // reddedilirse mesai yine açılır, yalnız bildirim düşmez.
        ensureNotifPermission().catch(() => {});
        // Pil kısıtlaması: ilk mesaide bir kez. Mesai AÇILDIKTAN sonra —
        // izin akışını bölmesin, ve mesai bu yüzden asla engellenmesin.
        void (async () => {
          try {
            if (await pilUyarisiGosterildiMi()) return;
            const secim = await pilUyarisiniGoster();
            if (secim === "muafiyet") await pilMuafiyetiIste(PAKET);
            else if (secim === "ayarlar") await uygulamaAyarlariniAc(PAKET);
            // "Sonra" dense bile işaretle: her mesaide sormak eziyet olur.
            // Şoför istediğinde alttaki kalıcı bağlantıdan ulaşabiliyor.
            await pilUyarisiniIsaretle();
          } catch {
            // Pil akışı mesaiyi ASLA bozmamalı.
          }
        })();
      } else {
        await stopTracking();
      }
      try {
        await setShift(next);
      } catch (e) {
        // Sunucuya yazamadıysak cihazdaki izlemeyi geri al — "cihazda açık,
        // sunucuda kapalı" tutarsızlığı olmasın.
        if (next) await stopTracking();
        const msg = e instanceof Error ? e.message : "";
        // 401 → setShift logout() yaptı; oturumu düşür.
        if (msg.includes("Oturum süresi doldu")) {
          setAuthed(false);
          setOnShift(false);
          Alert.alert("Oturum süresi doldu", "Lütfen tekrar giriş yap.");
        } else {
          Alert.alert(
            "Bağlantı hatası",
            "Mesai durumu değişmedi. Tekrar dene.",
          );
        }
        return;
      }
      setOnShift(next);
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await stopTracking();
    // Jetonu SİLMEDEN önce düşür — silince Bearer kalmaz.
    await pushSil();
    await logout();
    await AsyncStorage.removeItem(NAME_KEY);
    setAuthed(false);
    setRole(null);
    setOnShift(false);
  }

  const privacyLink = (
    <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
      <Text style={s.privacy}>Gizlilik Politikası</Text>
    </TouchableOpacity>
  );

  if (!authed) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.box}>
          <Text style={s.title}>🧼 En Yakın Halı Yıkama</Text>
          <TextInput
            style={s.input}
            placeholder="Kullanıcı adı veya e-posta"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={s.input}
            placeholder="Şifre"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity style={s.btn} onPress={doLogin} disabled={busy}>
            <Text style={s.btnText}>{busy ? "..." : "Giriş Yap"}</Text>
          </TouchableOpacity>
          {/* ŞİFRE SIFIRLAMA + KAYIT (2026-08-05, kullanıcı isteği).
              İkisi de web'de ZATEN VAR — uygulamada yalnız kapısı yoktu.
              Tarayıcıda açıyoruz, WebView'de değil: şifre sıfırlama e-postayla
              geliyor, kullanıcı o linke zaten tarayıcıdan tıklayacak. Aynı
              akışı iki farklı yerde yürütmek oturum karışıklığı üretirdi. */}
          <View style={s.baglantilar}>
            <TouchableOpacity
              onPress={() => Linking.openURL(`${API_BASE}/sifremi-unuttum`)}
            >
              <Text style={s.baglanti}>Şifremi unuttum</Text>
            </TouchableOpacity>
            <Text style={s.ayrac}>·</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`${API_BASE}/kayit`)}
            >
              <Text style={s.baglanti}>İşletme hesabı aç</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.hint}>
            İşletme, şoför ve komisyoncu — hepsi buradan giriyor. Şoförler
            kullanıcı adını çalıştığı işletmeden alır.
          </Text>
          {privacyLink}
        </View>
      </SafeAreaView>
    );
  }

  // ŞOFÖR DIŞINDAKİ ROLLER: panelin kendisi uygulamanın içinde açılır.
  // (Gerekçe ve sınırlar src/Panel.tsx başında yazılı.)
  if (role && role !== "DRIVER") {
    return (
      // 🔴 ALT KENAR HARİÇ (2026-08-07) — kullanıcı: "alttaki bölme çok
      // yukarıda, aşağıdaki yazılar okunmuyor."
      //
      // SEBEP: SafeAreaView alt kenara da boşluk koyuyordu; WebView sistem
      // gezinme çubuğunun ÜSTÜNDE bitiyor ve altta kalan şerit `screenTop`ün
      // açık gri zeminiyle (#f8fafc) doluyordu. Panelin kendi alt sekme çubuğu
      // (`fixed bottom-0`) o şeridin üstünde asılı kalıyor, ekranın dibine
      // oturmuyordu — "çubuk havada duruyor" görüntüsü buydu.
      //
      // ⚠️ ÇİFT GÜVENLİ ALAN: panel CSS'i zaten `env(safe-area-inset-bottom)`
      // uyguluyor. İki katman birden uygularsa boşluk İKİ KEZ ekleniyor.
      // Kural: güvenli alanı TEK katman sahiplenir. Web (tarayıcıda da açılıyor)
      // kendi işini zaten doğru yapıyor → burada alt kenarı bırakıyoruz.
      //
      // Şoför NATIVE ekranı (aşağıdaki dal) alt kenarı KULLANMAYA devam ediyor:
      // orada web yok, çıkış çubuğunu sistem çubuğuna yapıştırmamak gerekiyor.
      <SafeAreaView style={s.screenTop} edges={["top", "left", "right"]}>
        <Panel
          onLogout={doLogout}
          onSessionLost={() => {
            setAuthed(false);
            setRole(null);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screenTop}>
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.titleSmall}>{name || "Şoför"}</Text>
          <Text style={[s.statusSmall, onShift ? s.on : s.off]}>
            {onShift ? "🟢 Mesaidesin — konum paylaşılıyor" : "Mesai dışısın"}
          </Text>
          {/* Sessiz arıza görünür olsun: 3 dakikadır konum gitmiyorsa bu
              satır kırmızıya döner ve ne yapılacağını söyler. */}
          <Text
            style={[
              s.konumDurum,
              konumYasiSn != null && (konumYasiSn < 0 || konumYasiSn > 180)
                ? s.konumKotu
                : s.konumIyi,
            ]}
          >
            {!onShift
              ? ""
              : konumYasiSn == null
                ? ""
                : konumYasiSn < 0
                  ? "⚠️ Henüz konum gönderilemedi — açık alana çık, konum iznini “Her zaman izin ver” yap."
                  : konumYasiSn > 180
                    ? `⚠️ ${Math.round(konumYasiSn / 60)} dk'dır konum gitmiyor — mesaiyi kapatıp yeniden aç.`
                    : `Son konum: ${konumYasiSn} sn önce`}
          </Text>
          {/* Konum gitmiyorken şoförü ÇIKMAZDA bırakma: uyarı "ayarlardan
              düzelt" diyorsa oraya götüren bir düğme de olmalı. Yalnız sorun
              varken görünür — normalde ekranı kalabalıklaştırmasın. */}
          {onShift && konumYasiSn != null && (konumYasiSn < 0 || konumYasiSn > 180) && (
            <TouchableOpacity onPress={() => pilMuafiyetiIste(PAKET)}>
              <Text style={s.pilLink}>🔋 Pil kısıtlamasını kaldır →</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.shiftBtn, onShift && s.btnStop]}
          onPress={toggleShift}
          disabled={busy}
        >
          <Text style={s.shiftBtnText}>{onShift ? "Mesaiyi Bitir" : "Mesaiye Başla"}</Text>
        </TouchableOpacity>
      </View>

      <Orders
        onSessionExpired={() => {
          stopTracking();
          setAuthed(false);
          setOnShift(false);
        }}
      />

      <View style={s.bottomBar}>
        <TouchableOpacity onPress={doLogout}>
          <Text style={s.link}>Çıkış</Text>
        </TouchableOpacity>
        {privacyLink}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Driver />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc", justifyContent: "center" },
  screenTop: { flex: 1, backgroundColor: "#f8fafc" },
  box: { padding: 24, gap: 12 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  titleSmall: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  statusSmall: { fontSize: 13, fontWeight: "600", marginTop: 1 },
  konumDurum: { fontSize: 12, marginTop: 4, textAlign: "center" },
  konumIyi: { color: "#64748b" },
  konumKotu: { color: "#b91c1c", fontWeight: "600" },
  pilLink: {
    color: "#0d9488",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 4,
  },
  shiftBtn: {
    backgroundColor: "#0d9488",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  shiftBtnText: { color: "#fff", fontWeight: "700" },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  title: { fontSize: 26, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  status: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  on: { color: "#15803d" },
  off: { color: "#64748b" },
  hint: { fontSize: 13, color: "#64748b", textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  btn: {
    backgroundColor: "#0d9488",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnStop: { backgroundColor: "#ef4444" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { color: "#94a3b8", textAlign: "center", marginTop: 8 },
  privacy: {
    color: "#0d9488",
    textAlign: "center",
    marginTop: 4,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  baglantilar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  baglanti: {
    color: "#0d9488",
    fontSize: 14,
    fontWeight: "600",
    // 44px dokunma eşiği (panelde de aynı kural).
    paddingVertical: 11,
    paddingHorizontal: 4,
  },
  ayrac: { color: "#94a3b8", fontSize: 14 },
});
