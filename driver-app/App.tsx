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
import { login, getToken, logout, setShift } from "./src/api";
import { startTracking, stopTracking, isTracking } from "./src/tracking";

const NAME_KEY = "hali_driver_name";
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
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [onShift, setOnShift] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setAuthed(!!(await getToken()));
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
      setAuthed(true);
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function toggleShift() {
    setBusy(true);
    try {
      const next = !onShift;
      if (next) {
        // Play politikası: izin isteğinden ÖNCE belirgin açıklama + onay.
        const accepted = await askLocationDisclosure();
        if (!accepted) return;
        const err = await startTracking();
        if (err) {
          Alert.alert("İzin gerekli", err);
          return;
        }
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
    await logout();
    await AsyncStorage.removeItem(NAME_KEY);
    setAuthed(false);
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
          <Text style={s.title}>🚚 Halı Şoför</Text>
          <TextInput
            style={s.input}
            placeholder="Kullanıcı adı"
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
          <Text style={s.hint}>
            Kullanıcı adını ve şifreni çalıştığın işletmeden alabilirsin.
          </Text>
          {privacyLink}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.box}>
        <Text style={s.title}>{name || "Şoför"}</Text>
        <Text style={[s.status, onShift ? s.on : s.off]}>
          {onShift
            ? "🟢 Mesaidesin — konumun paylaşılıyor"
            : "Mesai dışısın"}
        </Text>
        <Text style={s.hint}>
          {onShift
            ? "Uygulamayı kapatabilir, telefonla konuşabilirsin — konum arka planda iletilmeye devam eder."
            : "Mesaiye başlayınca konumun, uygulama kapalıyken bile halıcına iletilir."}
        </Text>
        <TouchableOpacity
          style={[s.btn, onShift && s.btnStop]}
          onPress={toggleShift}
          disabled={busy}
        >
          <Text style={s.btnText}>
            {onShift ? "Mesaiyi Bitir" : "Mesaiye Başla"}
          </Text>
        </TouchableOpacity>
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
  box: { padding: 24, gap: 12 },
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
});
