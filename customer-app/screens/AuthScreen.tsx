import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  customerLogin,
  requestRegisterCode,
  customerRegister,
  ApiError,
} from "../lib/api";
import { C } from "../lib/theme";
import type { Nav } from "../lib/nav";

/**
 * Giriş / kayıt ekranı. Değerlendirme ve sipariş geçmişi için üyelik gerekir
 * (web /uye-ol karşılığı). Kayıt e-posta doğrulama koduyla iki adımlı.
 */
export function AuthScreen({
  nav,
  onAuthed,
}: {
  nav: Nav;
  onAuthed: (name: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  function err(e: unknown, fallback: string) {
    Alert.alert("Olmadı", e instanceof ApiError ? e.message : fallback);
  }

  async function doLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Eksik bilgi", "E-posta ve şifreni gir.");
      return;
    }
    setBusy(true);
    try {
      const { name: n } = await customerLogin(email.trim().toLowerCase(), password);
      onAuthed(n);
      nav.back();
    } catch (e) {
      err(e, "Giriş başarısız — bilgileri kontrol et.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert("E-posta hatalı", "Geçerli bir e-posta gir.");
      return;
    }
    setBusy(true);
    try {
      await requestRegisterCode(email.trim().toLowerCase());
      setCodeSent(true);
      Alert.alert("Kod gönderildi", "E-postana gelen 6 haneli kodu gir.");
    } catch (e) {
      err(e, "Kod gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function doRegister() {
    const p = phone.replace(/\D/g, "");
    if (name.trim().length < 2) return Alert.alert("Eksik", "Ad soyad gir.");
    if (!/^05\d{9}$/.test(p))
      return Alert.alert("Telefon", "05xx ile 11 haneli cep no gir.");
    if (password.length < 8)
      return Alert.alert("Şifre", "Şifre en az 8 karakter olmalı.");
    if (code.trim().length !== 6)
      return Alert.alert("Kod", "E-postana gelen 6 haneli kodu gir.");
    setBusy(true);
    try {
      const { name: n } = await customerRegister({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: p,
        password,
        emailCode: code.trim(),
      });
      onAuthed(n);
      nav.back();
    } catch (e) {
      err(e, "Kayıt tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={nav.back}>
            <Text style={s.back}>← Geri</Text>
          </TouchableOpacity>

          <Text style={s.title}>
            {mode === "login" ? "Giriş Yap" : "Üye Ol"}
          </Text>
          <Text style={s.sub}>
            {mode === "login"
              ? "Siparişlerini ve değerlendirmelerini yönet."
              : "Değerlendirme yapmak ve siparişlerini görmek için üye ol."}
          </Text>

          <View style={s.tabs}>
            <TouchableOpacity
              style={[s.tab, mode === "login" && s.tabOn]}
              onPress={() => setMode("login")}
            >
              <Text style={[s.tabText, mode === "login" && s.tabTextOn]}>
                Giriş
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, mode === "register" && s.tabOn]}
              onPress={() => setMode("register")}
            >
              <Text style={[s.tabText, mode === "register" && s.tabTextOn]}>
                Üye Ol
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={s.input}
            placeholder="E-posta"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            editable={!(mode === "register" && codeSent)}
          />

          {mode === "login" ? (
            <>
              <TextInput
                style={s.input}
                placeholder="Şifre"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={[s.btn, busy && s.btnOff]}
                onPress={doLogin}
                disabled={busy}
              >
                <Text style={s.btnText}>
                  {busy ? "..." : "Giriş Yap"}
                </Text>
              </TouchableOpacity>
            </>
          ) : !codeSent ? (
            <TouchableOpacity
              style={[s.btn, busy && s.btnOff]}
              onPress={sendCode}
              disabled={busy}
            >
              <Text style={s.btnText}>
                {busy ? "..." : "Doğrulama Kodu Gönder"}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TextInput
                style={s.input}
                placeholder="Ad Soyad"
                value={name}
                onChangeText={setName}
              />
              <TextInput
                style={s.input}
                placeholder="Telefon (05xx...)"
                keyboardType="phone-pad"
                maxLength={11}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, ""))}
              />
              <TextInput
                style={s.input}
                placeholder="Şifre (en az 8 karakter)"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <TextInput
                style={s.input}
                placeholder="E-postana gelen 6 haneli kod"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
              />
              <TouchableOpacity
                style={[s.btn, busy && s.btnOff]}
                onPress={doRegister}
                disabled={busy}
              >
                <Text style={s.btnText}>{busy ? "..." : "Üyeliği Tamamla"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={sendCode} disabled={busy}>
                <Text style={s.resend}>Kod gelmedi mi? Tekrar gönder</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  back: { color: C.brandDark, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "800", color: C.text, marginTop: 8 },
  sub: { color: C.sub, marginTop: 2, marginBottom: 14 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  tabOn: { borderColor: C.brand, backgroundColor: C.brandLight },
  tabText: { color: C.sub, fontWeight: "600" },
  tabTextOn: { color: C.brandDark },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#fff",
    marginTop: 10,
  },
  btn: {
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  btnOff: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  resend: { color: C.brandDark, textAlign: "center", marginTop: 12 },
});
