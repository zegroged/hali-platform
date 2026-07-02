import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import { getBusinesses, imageUrl, type Business } from "../lib/api";
import { useResponsive } from "../lib/responsive";
import { C } from "../lib/theme";
import type { Nav } from "../lib/nav";

function Card({
  b,
  width,
  onPress,
}: {
  b: Business;
  width: number;
  onPress: () => void;
}) {
  const cover = imageUrl(b.coverUrl);
  const dist =
    b.distanceKm != null
      ? b.distanceKm < 1
        ? `${Math.round(b.distanceKm * 1000)} m`
        : `${b.distanceKm.toFixed(1)} km`
      : null;
  return (
    <TouchableOpacity style={[s.card, { width }]} activeOpacity={0.8} onPress={onPress}>
      <View style={[s.cover, { height: Math.round(width * 0.62) }]}>
        {cover ? (
          <Image source={{ uri: cover }} style={s.coverImg} />
        ) : (
          <Text style={{ fontSize: 30 }}>🧺</Text>
        )}
      </View>
      <View style={s.cardTop}>
        <Text style={s.rating}>★ {b.ratingAvg.toFixed(1)}</Text>
        <Text style={[s.badge, b.isOpenNow ? s.open : s.closed]}>
          {b.isOpenNow ? "Açık" : "Kapalı"}
        </Text>
      </View>
      <Text style={s.name} numberOfLines={1}>
        {b.name}
      </Text>
      <Text style={s.sub} numberOfLines={1}>
        {b.district}
        {dist ? ` · ${dist}` : ""}
      </Text>
      <Text style={s.meta} numberOfLines={1}>
        {b.deliveryMaxDays != null
          ? `🚚 ${b.deliveryMinDays}-${b.deliveryMaxDays} gün`
          : ""}
        {b.minPrice != null ? ` · ${b.minPrice} TL/m²` : ""}
      </Text>
    </TouchableOpacity>
  );
}

function Row({
  title,
  items,
  cardWidth,
  nav,
}: {
  title: string;
  items: Business[];
  cardWidth: number;
  nav: Nav;
}) {
  if (!items.length) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={s.rowTitle}>{title}</Text>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <Card
            b={item}
            width={cardWidth}
            onPress={() => nav.go({ name: "profile", id: item.id })}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      />
    </View>
  );
}

export function HomeScreen({ nav }: { nav: Nav }) {
  const r = useResponsive();
  const [all, setAll] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [located, setLocated] = useState(false);

  const load = useCallback(async (coords?: { lat: number; lng: number }) => {
    setLoading(true);
    try {
      setAll(await getBusinesses(coords));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function useMyLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const pos = await Location.getCurrentPositionAsync({});
    setLocated(true);
    load({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  }

  const nearest = located ? all.slice(0, 10) : [];
  const topRated = [...all]
    .filter((b) => b.ratingCount > 0)
    .sort((a, b) => b.ratingAvg - a.ratingAvg)
    .slice(0, 10);
  const fastest = [...all]
    .filter((b) => b.deliveryMaxDays != null)
    .sort((a, b) => (a.deliveryMaxDays as number) - (b.deliveryMaxDays as number))
    .slice(0, 10);
  const fresh = all.filter((b) => b.isNew).slice(0, 10);

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={{ width: "100%", maxWidth: r.contentMaxWidth, alignSelf: "center", flex: 1 }}>
        <View style={s.headerRow}>
          <Text style={[s.brand, { fontSize: r.scale(22) }]}>🧼 Halını Aldır</Text>
          <TouchableOpacity onPress={() => nav.go({ name: "track" })}>
            <Text style={s.headerLink}>📦 Takip</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.locBtn} onPress={useMyLocation}>
          <Text style={[s.locBtnText, { fontSize: r.scale(15) }]}>
            📍 Konumumu kullan
          </Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 50 }} color={C.brand} size="large" />
        ) : all.length === 0 ? (
          <Text style={s.empty}>Halıcı bulunamadı. Backend adresini kontrol et.</Text>
        ) : (
          <FlatList
            data={[0]}
            keyExtractor={() => "root"}
            renderItem={() => (
              <View style={{ paddingBottom: 32 }}>
                <Row title="📍 Sana en yakın" items={nearest} cardWidth={r.cardWidth} nav={nav} />
                <Row title="⭐ En çok tercih edilenler" items={topRated} cardWidth={r.cardWidth} nav={nav} />
                <Row title="⚡ Hızlı teslim" items={fastest} cardWidth={r.cardWidth} nav={nav} />
                <Row title="🆕 Yeni halıcılar" items={fresh} cardWidth={r.cardWidth} nav={nav} />
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  brand: { fontWeight: "800", color: C.text },
  headerLink: { color: C.sub, fontSize: 14 },
  locBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  locBtnText: { color: "#fff", fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 40, color: C.sub, paddingHorizontal: 24 },
  rowTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
  },
  cover: {
    borderRadius: 10,
    backgroundColor: C.brandLight,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  coverImg: { width: "100%", height: "100%" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rating: { fontWeight: "700", color: C.text },
  badge: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  open: { backgroundColor: C.greenBg, color: C.green },
  closed: { backgroundColor: C.slateBg, color: C.sub },
  name: { marginTop: 4, fontWeight: "600", color: C.text },
  sub: { color: C.sub, fontSize: 12 },
  meta: { color: C.sub, fontSize: 12, marginTop: 2 },
});
