import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { login, getToken, logout, setShift } from "./src/api";
import { startTracking, stopTracking, isTracking } from "./src/tracking";

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
    })();
  }, []);

  async function doLogin() {
    setBusy(true);
    try {
      const d = await login(identifier.trim(), password);
      setName(d.name);
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
        const err = await startTracking();
        if (err) {
          Alert.alert("İzin gerekli", err);
          return;
        }
      } else {
        await stopTracking();
      }
      await setShift(next);
      setOnShift(next);
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await stopTracking();
    await logout();
    setAuthed(false);
    setOnShift(false);
  }

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
          <TouchableOpacity
            style={s.btn}
            onPress={doLogin}
            disabled={busy}
          >
            <Text style={s.btnText}>{busy ? "..." : "Giriş Yap"}</Text>
          </TouchableOpacity>
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
});
