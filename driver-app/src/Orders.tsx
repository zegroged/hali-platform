import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  RefreshControl,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  listOrders,
  acceptOrder,
  rejectOrder,
  advanceOrder,
  pickupOrder,
  deliverOrder,
  type DriverOrder,
} from "./api";

const STATUS_LABEL: Record<string, string> = {
  CREATED: "Yeni talep",
  ACCEPTED: "Kabul edildi",
  PICKED_UP: "Halı alındı",
  WASHING: "Yıkanıyor",
  OUT_FOR_DELIVERY: "Yolda",
};

// PICKED_UP → sıradaki adım etiketi
const ADVANCE_LABEL: Record<string, string> = {
  PICKED_UP: "Yıkamaya al",
  WASHING: "Teslime çıktım",
};

async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      "Kamera izni gerekli",
      "Halının fotoğrafını çekmek için kamera iznine izin ver.",
    );
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({
    quality: 0.6,
    allowsEditing: false,
  });
  if (res.canceled || !res.assets?.[0]?.uri) return null;
  return res.assets[0].uri;
}

export function Orders({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const fetchOrders = useCallback(async () => {
    try {
      setOrders(await listOrders());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Oturum süresi doldu")) onSessionExpired();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 20000); // 20 sn'de bir tazele
    return () => clearInterval(t);
  }, [fetchOrders]);

  async function run(id: string, fn: () => Promise<void>) {
    setActingId(id);
    try {
      await fn();
      await fetchOrders();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "İşlem yapılamadı.";
      if (msg.includes("Oturum süresi doldu")) onSessionExpired();
      else Alert.alert("Olmadı", msg);
    } finally {
      setActingId(null);
    }
  }

  function confirmReject(o: DriverOrder) {
    Alert.alert("Siparişi reddet", "Bu talebi reddetmek istediğine emin misin?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Reddet",
        style: "destructive",
        onPress: () => run(o.id, () => rejectOrder(o.id, "Uygun değil")),
      },
    ]);
  }

  async function doPickup(o: DriverOrder) {
    const uri = await takePhoto();
    if (!uri) return;
    run(o.id, () => pickupOrder(o.id, uri));
  }

  async function doDeliver(o: DriverOrder) {
    const price = Number((prices[o.id] ?? "").replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert("Tutar gerekli", "Tahsil edilen tutarı gir (0'dan büyük).");
      return;
    }
    const uri = await takePhoto();
    if (!uri) return;
    run(o.id, () => deliverOrder(o.id, price, uri));
  }

  function mapUrl(o: DriverOrder): string {
    if (o.pickupLat != null && o.pickupLng != null)
      return `https://www.google.com/maps/search/?api=1&query=${o.pickupLat},${o.pickupLng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.pickupAddress)}`;
  }

  function renderActions(o: DriverOrder) {
    const busy = actingId === o.id;
    if (o.status === "CREATED")
      return (
        <View style={s.row}>
          <TouchableOpacity
            style={[s.btn, busy && s.off]}
            disabled={busy}
            onPress={() => run(o.id, () => acceptOrder(o.id))}
          >
            <Text style={s.btnText}>Kabul Et</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnGhost]}
            disabled={busy}
            onPress={() => confirmReject(o)}
          >
            <Text style={s.btnGhostText}>Reddet</Text>
          </TouchableOpacity>
        </View>
      );
    if (o.status === "ACCEPTED")
      return (
        <TouchableOpacity
          style={[s.btn, busy && s.off]}
          disabled={busy}
          onPress={() => doPickup(o)}
        >
          <Text style={s.btnText}>📷 Halıyı Aldım (fotoğraf zorunlu)</Text>
        </TouchableOpacity>
      );
    if (o.status === "PICKED_UP" || o.status === "WASHING")
      return (
        <TouchableOpacity
          style={[s.btn, busy && s.off]}
          disabled={busy}
          onPress={() => run(o.id, () => advanceOrder(o.id, true))}
        >
          <Text style={s.btnText}>{ADVANCE_LABEL[o.status]}</Text>
        </TouchableOpacity>
      );
    if (o.status === "OUT_FOR_DELIVERY")
      return (
        <View style={{ gap: 8 }}>
          <TextInput
            style={s.input}
            placeholder="Tahsil edilen tutar (TL)"
            keyboardType="decimal-pad"
            value={prices[o.id] ?? ""}
            onChangeText={(v) => setPrices((p) => ({ ...p, [o.id]: v }))}
          />
          <TouchableOpacity
            style={[s.btn, busy && s.off]}
            disabled={busy}
            onPress={() => doDeliver(o)}
          >
            <Text style={s.btnText}>📷 Teslim Et & Tahsilat (fotoğraf zorunlu)</Text>
          </TouchableOpacity>
        </View>
      );
    return null;
  }

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
      data={orders}
      keyExtractor={(o) => o.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchOrders();
          }}
        />
      }
      ListHeaderComponent={
        <Text style={s.header}>
          Aktif siparişler {orders.length > 0 ? `(${orders.length})` : ""}
        </Text>
      }
      ListEmptyComponent={
        <Text style={s.empty}>
          {loading ? "Yükleniyor…" : "Şu an aktif siparişin yok. Aşağı çekerek yenile."}
        </Text>
      }
      renderItem={({ item: o }) => (
        <View style={s.card}>
          <View style={s.cardTop}>
            <Text style={s.status}>{STATUS_LABEL[o.status] ?? o.status}</Text>
            {!!o.code && <Text style={s.code}>{o.code}</Text>}
          </View>
          <Text style={s.name}>{o.customerName}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${o.customerPhone}`)}>
            <Text style={s.link}>📞 {o.customerPhone}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(mapUrl(o))}>
            <Text style={s.addr}>📍 {o.pickupAddress}</Text>
          </TouchableOpacity>
          {o.approxM2 != null && <Text style={s.meta}>~{o.approxM2} m²</Text>}
          {!!o.note && <Text style={s.note}>Not: {o.note}</Text>}
          {o.quotedPrice != null && (
            <Text style={s.meta}>
              Bildirilen fiyat: {o.quotedPrice} TL
              {o.priceApprovedAt ? " · müşteri onayladı ✓" : " · onay bekliyor"}
            </Text>
          )}
          <View style={{ marginTop: 8 }}>{renderActions(o)}</View>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  header: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 30 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  status: { color: "#0f766e", fontWeight: "700" },
  code: { color: "#94a3b8", fontFamily: "monospace", fontSize: 12 },
  name: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginTop: 4 },
  link: { color: "#0d9488", marginTop: 2 },
  addr: { color: "#0d9488", marginTop: 2 },
  meta: { color: "#64748b", fontSize: 13, marginTop: 2 },
  note: { color: "#64748b", fontSize: 13, fontStyle: "italic", marginTop: 2 },
  row: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1,
    backgroundColor: "#0d9488",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  off: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  btnGhost: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  btnGhostText: { color: "#ef4444", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: "#fff",
  },
});
