import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { createOrder, ApiError, API_BASE } from "../lib/api";
import { C } from "../lib/theme";
import type { Nav } from "../lib/nav";

/** m² metnini sayıya çevirir; Türkçe virgüllü ondalık da kabul eder. */
function parseM2(v: string): number | undefined {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function OrderScreen({
  nav,
  id,
  businessName,
}: {
  nav: Nav;
  id: string;
  businessName: string;
}) {
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    pickupAddress: "",
    approxM2: "",
    note: "",
  });
  // Mesafeli Sözleşmeler Yön. md.7: ön bilgilendirme TEYİDİ — işaretlenmemiş
  // başlar, işaretlenmeden sipariş gönderilmez (sunucu da bunsuz reddeder).
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  // Konum: şoför navigasyonu için (native GPS en doğru). Opsiyonel.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locBusy, setLocBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function captureLocation() {
    setLocBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Konum izni yok",
          "Konum eklenmeden de sipariş verebilirsin; adresi yazman yeterli. İzin verirsen şoför halını daha kolay bulur.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert("Konum alınamadı", "Tekrar dene veya adresi yazarak devam et.");
    } finally {
      setLocBusy(false);
    }
  }

  async function submit() {
    const phone = form.customerPhone.replace(/\D/g, "");
    // Sunucu zod şemasıyla hizalı istemci kontrolü (min uzunluklar) — sınır
    // aşımı jenerik 400'e düşmesin.
    if (form.customerName.trim().length < 2) {
      Alert.alert("Eksik bilgi", "Ad soyad en az 2 karakter olmalı.");
      return;
    }
    if (phone.length < 10) {
      Alert.alert("Eksik bilgi", "Geçerli bir telefon numarası gir (05xx...).");
      return;
    }
    if (form.pickupAddress.trim().length < 5) {
      Alert.alert("Eksik bilgi", "Halının alınacağı adresi biraz daha ayrıntılı yaz.");
      return;
    }
    const email = form.customerEmail.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert("E-posta hatalı", "Geçerli bir e-posta gir veya boş bırak.");
      return;
    }
    // m² yazıldıysa geçerli olmalı — sessizce silinip m²'siz sipariş gitmesin.
    const m2 = form.approxM2 ? parseM2(form.approxM2) : undefined;
    if (form.approxM2 && m2 === undefined) {
      Alert.alert("m² hatalı", "Yaklaşık m² sayı olmalı (örn. 12 veya 12,5).");
      return;
    }
    if (!consent) {
      Alert.alert(
        "Onay gerekli",
        "Sipariş için ön bilgilendirme ve mesafeli satış sözleşmesini onaylaman gerekiyor.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await createOrder({
        businessId: id,
        customerName: form.customerName.trim(),
        customerPhone: phone,
        customerEmail: email || undefined,
        pickupAddress: form.pickupAddress.trim(),
        pickupLat: coords?.lat,
        pickupLng: coords?.lng,
        approxM2: m2,
        note: form.note || undefined,
        paymentMethod: "CASH",
        consent: true,
      });
      // replace: takipten "geri" boşalmış sipariş formuna değil profile dönsün.
      // token=UZUN takip token'ı (kesin-fiyat onayı/iptal bununla çalışır —
      // kısa kod yetkisiz); code=ekranda gösterilecek kısa referans.
      nav.replace({
        name: "track",
        token: res.trackingToken,
        code: res.code ?? undefined,
      });
    } catch (e) {
      // Sunucunun gerçek mesajı (tatil modu, şoför yok...) müşteriye gösterilir.
      Alert.alert(
        "Sipariş oluşturulamadı",
        e instanceof ApiError ? e.message : "Bağlantı hatası — tekrar dene.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={nav.back}>
          <Text style={s.back}>← Geri</Text>
        </TouchableOpacity>
        <Text style={s.title}>Halımı Aldır</Text>
        <Text style={s.sub}>{businessName}</Text>

        <TextInput
          style={s.input}
          placeholder="Ad Soyad"
          maxLength={100}
          value={form.customerName}
          onChangeText={(v) => set("customerName", v)}
        />
        <TextInput
          style={s.input}
          placeholder="Telefon (05xx...)"
          keyboardType="phone-pad"
          maxLength={11}
          value={form.customerPhone}
          onChangeText={(v) => set("customerPhone", v.replace(/\D/g, ""))}
        />
        <TextInput
          style={s.input}
          placeholder="E-posta (opsiyonel — takip linki gelsin)"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={120}
          value={form.customerEmail}
          onChangeText={(v) => set("customerEmail", v)}
        />
        <TextInput
          style={[s.input, { height: 70 }]}
          placeholder="Halının alınacağı adres"
          multiline
          maxLength={300}
          value={form.pickupAddress}
          onChangeText={(v) => set("pickupAddress", v)}
        />
        {/* Konum: şoför halını tam noktada bulsun (opsiyonel). */}
        <TouchableOpacity
          style={[s.locBtn, coords && s.locBtnOn]}
          onPress={captureLocation}
          disabled={locBusy}
          accessibilityRole="button"
        >
          <Text style={[s.locText, coords && s.locTextOn]}>
            {locBusy
              ? "Konum alınıyor…"
              : coords
                ? "📍 Konum eklendi ✓ (değiştirmek için tekrar dokun)"
                : "📍 Konumumu ekle (şoför halını kolay bulsun)"}
          </Text>
        </TouchableOpacity>
        <TextInput
          style={s.input}
          placeholder="Yaklaşık m² (opsiyonel)"
          keyboardType="decimal-pad"
          value={form.approxM2}
          onChangeText={(v) => set("approxM2", v)}
        />
        <TextInput
          style={[s.input, { height: 60 }]}
          placeholder="Not (opsiyonel)"
          multiline
          maxLength={500}
          value={form.note}
          onChangeText={(v) => set("note", v)}
        />

        {/* Ödeme: web ile aynı — şimdilik yalnız teslimde nakit */}
        <View style={s.payBox}>
          <Text style={s.payTitle}>💵 Ödeme teslimde, nakit</Text>
          <Text style={s.payNote}>
            Sipariş verirken ön ödeme alınmaz; halın temiz teslim edildiğinde
            ödersin. Kartlı ödeme çok yakında.
          </Text>
        </View>

        {/* Ön bilgilendirme özeti (Mesafeli Söz. Yön. md.6/1-2) — zorunlu
            asgari açıklamalar, sipariş ONAYINDAN ÖNCE. */}
        <View style={s.infoSummary}>
          <Text style={s.infoSummaryTitle}>Sipariş özeti — önemli bilgiler</Text>
          <Text style={s.infoSummaryText}>
            • Hizmet: halının adresten alınması, yıkanması ve adrese teslimi.{"\n"}
            • Fiyat: profildeki birim fiyatlar tahminidir; kesin bedel halı
            ölçüldükten sonra bildirilir ve onayına sunulur.{"\n"}
            • Ödeme: ön ödeme yok; teslimde nakit alınır.{"\n"}
            • Cayma: halı yıkanmadan her an ücretsiz iptal/iade; kesin fiyatı
            onaylayıp yıkama başladıktan sonra cayma hakkı kullanılamaz
            (md.15/1-h).{"\n"}
            • Kusurlu hizmette 2 yıl içinde yasal haklarınız saklıdır.
          </Text>
        </View>

        {/* md.7 teyidi — sunucu consentAt + sözleşme sürümünü kaydeder. */}
        <View style={s.legalLinks}>
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => Linking.openURL(`${API_BASE}/on-bilgilendirme`)}
          >
            <Text style={s.link}>Ön bilgilendirme ↗</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => Linking.openURL(`${API_BASE}/mesafeli-satis`)}
          >
            <Text style={s.link}>Mesafeli satış ↗</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => Linking.openURL(`${API_BASE}/iade`)}
          >
            <Text style={s.link}>İptal/İade ↗</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => Linking.openURL(`${API_BASE}/kvkk`)}
          >
            <Text style={s.link}>KVKK Aydınlatma ↗</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.kvkkNote}>
          Sipariş bilgilerin yalnız seçtiğin işletmeyle, hizmetin ifası için
          paylaşılır (bkz. KVKK Aydınlatma Metni).
        </Text>
        <TouchableOpacity
          style={s.consentRow}
          onPress={() => setConsent((c) => !c)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel="Ön bilgilendirme formunu ve mesafeli satış sözleşmesini okudum, onaylıyorum"
        >
          <View style={[s.checkbox, consent && s.checkboxOn]}>
            {consent && <Text style={s.checkmark}>✓</Text>}
          </View>
          <Text style={s.consentText}>
            Yukarıdaki ön bilgilendirme formunu ve mesafeli satış sözleşmesini
            okudum, onaylıyorum. Kesin fiyat halım ölçüldükten sonra onayıma
            sunulacak.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.submit, (!consent || loading) && s.submitOff]}
          onPress={submit}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={s.submitText}>
            {loading ? "Gönderiliyor…" : "Talebi Oluştur"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  back: { color: C.brandDark, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "800", color: C.text, marginTop: 8 },
  sub: { color: C.sub, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: "#fff",
    marginTop: 10,
  },
  locBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  locBtnOn: { borderColor: C.brand, backgroundColor: C.brandLight },
  locText: { color: C.sub, fontSize: 14 },
  locTextOn: { color: C.brandDark, fontWeight: "600" },
  infoSummary: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.slateBg,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoSummaryTitle: { fontWeight: "700", color: C.text, marginBottom: 6 },
  infoSummaryText: { color: C.text, fontSize: 15, lineHeight: 22 },
  kvkkNote: { color: C.sub, fontSize: 12, marginTop: 6 },
  payBox: {
    marginTop: 16,
    backgroundColor: C.brandLight,
    borderRadius: 10,
    padding: 12,
  },
  payTitle: { color: C.brandDark, fontWeight: "700" },
  payNote: { color: C.brandDark, fontSize: 12, marginTop: 4 },
  consentRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    alignItems: "flex-start",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: C.brand, borderColor: C.brand },
  checkmark: { color: "#fff", fontWeight: "800", fontSize: 14 },
  consentText: { flex: 1, color: C.sub, fontSize: 13, lineHeight: 19 },
  legalLinks: { marginTop: 16, gap: 6 },
  link: { color: C.brandDark, fontWeight: "600", fontSize: 13 },
  submit: {
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 16,
  },
  submitOff: { opacity: 0.5 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
