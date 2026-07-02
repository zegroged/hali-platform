import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createOrder } from "../lib/api";
import { C } from "../lib/theme";
import type { Nav } from "../lib/nav";

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
    pickupAddress: "",
    approxM2: "",
    note: "",
    paymentMethod: "CASH" as "CASH" | "CARD",
  });
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (
      !form.customerName ||
      form.customerPhone.length < 10 ||
      form.pickupAddress.length < 5
    ) {
      Alert.alert("Eksik bilgi", "Ad, telefon ve adres gerekli.");
      return;
    }
    setLoading(true);
    try {
      const res = await createOrder({
        businessId: id,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        pickupAddress: form.pickupAddress,
        approxM2: form.approxM2 ? Number(form.approxM2) : undefined,
        note: form.note || undefined,
        paymentMethod: form.paymentMethod,
      });
      nav.go({ name: "track", code: res.code ?? res.trackingToken });
    } catch {
      Alert.alert("Hata", "Sipariş oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={nav.back}>
          <Text style={s.back}>← Geri</Text>
        </TouchableOpacity>
        <Text style={s.title}>Halımı Aldır</Text>
        <Text style={s.sub}>{businessName}</Text>

        <TextInput
          style={s.input}
          placeholder="Ad Soyad"
          value={form.customerName}
          onChangeText={(v) => set("customerName", v)}
        />
        <TextInput
          style={s.input}
          placeholder="Telefon (05xx...)"
          keyboardType="phone-pad"
          value={form.customerPhone}
          onChangeText={(v) => set("customerPhone", v)}
        />
        <TextInput
          style={[s.input, { height: 70 }]}
          placeholder="Halının alınacağı adres"
          multiline
          value={form.pickupAddress}
          onChangeText={(v) => set("pickupAddress", v)}
        />
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
          value={form.note}
          onChangeText={(v) => set("note", v)}
        />

        <Text style={s.label}>Ödeme</Text>
        <View style={s.payRow}>
          {(["CASH", "CARD"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[s.payBtn, form.paymentMethod === m && s.payOn]}
              onPress={() => set("paymentMethod", m)}
            >
              <Text style={form.paymentMethod === m ? s.payOnText : s.payText}>
                {m === "CASH" ? "Kapıda Nakit" : "Kartla"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.submit} onPress={submit} disabled={loading}>
          <Text style={s.submitText}>
            {loading ? "Gönderiliyor…" : "Talebi Oluştur"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  label: { fontWeight: "600", color: C.text, marginTop: 16, marginBottom: 6 },
  payRow: { flexDirection: "row", gap: 10 },
  payBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  payOn: { borderColor: C.brand, backgroundColor: C.brandLight },
  payText: { color: C.sub },
  payOnText: { color: C.brandDark, fontWeight: "600" },
  submit: {
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
