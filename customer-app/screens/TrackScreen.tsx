import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import { getTracking, type Tracking } from "../lib/api";
import { C } from "../lib/theme";
import type { Nav } from "../lib/nav";

const FLOW: [string, string][] = [
  ["CREATED", "📝 Talep alındı"],
  ["ACCEPTED", "✅ Kabul edildi"],
  ["PICKED_UP", "📦 Halı alındı"],
  ["WASHING", "🧼 Yıkanıyor"],
  ["OUT_FOR_DELIVERY", "🚚 Yola çıktı"],
  ["DELIVERED", "🏠 Teslim edildi"],
];

export function TrackScreen({ nav, code }: { nav: Nav; code?: string }) {
  const [input, setInput] = useState(code ?? "");
  const [activeCode, setActiveCode] = useState(code ?? "");
  const [data, setData] = useState<Tracking | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async (c: string) => {
    const t = await getTracking(c.trim().toUpperCase());
    if (t) {
      setData(t);
      setNotFound(false);
    } else {
      setData(null);
      setNotFound(true);
    }
  }, []);

  useEffect(() => {
    if (!activeCode) return;
    load(activeCode);
    const id = setInterval(() => load(activeCode), 6000);
    return () => clearInterval(id);
  }, [activeCode, load]);

  const currentIdx = data ? FLOW.findIndex((f) => f[0] === data.status) : -1;
  const rejected = data?.status === "REJECTED";

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={nav.back}>
          <Text style={s.back}>← Geri</Text>
        </TouchableOpacity>
        <Text style={s.title}>📦 Sipariş Takibi</Text>

        <View style={s.searchRow}>
          <TextInput
            style={s.input}
            placeholder="Takip kodu"
            autoCapitalize="characters"
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity
            style={s.btn}
            onPress={() => setActiveCode(input.trim().toUpperCase())}
          >
            <Text style={s.btnText}>Takip Et</Text>
          </TouchableOpacity>
        </View>

        {notFound && (
          <Text style={s.empty}>Bu kodla sipariş bulunamadı.</Text>
        )}

        {data && (
          <View style={{ marginTop: 18 }}>
            <Text style={s.biz}>{data.business.name}</Text>

            {rejected ? (
              <View style={s.rejected}>
                <Text style={s.rejectedTitle}>Talep reddedildi</Text>
                {data.rejectReason && (
                  <Text style={s.rejectedReason}>Sebep: {data.rejectReason}</Text>
                )}
              </View>
            ) : (
              FLOW.map(([st, label], i) => {
                const done = i <= currentIdx;
                return (
                  <View key={st} style={s.step}>
                    <View style={[s.dot, done ? s.dotOn : s.dotOff]} />
                    <Text style={done ? s.stepOn : s.stepOff}>{label}</Text>
                  </View>
                );
              })
            )}

            {data.driver && (
              <View style={{ marginTop: 14 }}>
                <Text style={s.driverText}>
                  🚚 {data.driver.name} teslime çıktı — yolda.
                </Text>
                <MapView
                  style={{
                    width: "100%",
                    height: 220,
                    borderRadius: 12,
                    marginTop: 8,
                  }}
                  region={{
                    latitude: data.driver.lat,
                    longitude: data.driver.lng,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: data.driver.lat,
                      longitude: data.driver.lng,
                    }}
                    title={data.driver.name}
                    pinColor="#0d9488"
                  />
                </MapView>
              </View>
            )}

            {data.priceTotal != null && (
              <View style={s.priceBox}>
                <Text style={s.priceText}>
                  Tutar: {data.priceTotal} TL ·{" "}
                  {data.paymentMethod === "CARD" ? "Kartla" : "Kapıda nakit"}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  back: { color: C.brandDark, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "800", color: C.text, marginTop: 8 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: "#fff",
    letterSpacing: 2,
  },
  btn: {
    backgroundColor: C.brand,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 24, color: C.sub },
  biz: { color: C.sub, marginBottom: 10 },
  step: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotOn: { backgroundColor: C.brand },
  dotOff: { backgroundColor: C.border },
  stepOn: { color: C.text, fontWeight: "600" },
  stepOff: { color: C.sub },
  driverBox: {
    marginTop: 14,
    backgroundColor: C.brandLight,
    borderRadius: 10,
    padding: 12,
  },
  driverText: { color: C.brandDark, fontWeight: "600" },
  rejected: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12,
  },
  rejectedTitle: { color: "#b91c1c", fontWeight: "700" },
  rejectedReason: { color: "#dc2626", marginTop: 4 },
  priceBox: {
    marginTop: 14,
    backgroundColor: C.brandLight,
    borderRadius: 10,
    padding: 12,
  },
  priceText: { color: C.brandDark, fontWeight: "600" },
});
