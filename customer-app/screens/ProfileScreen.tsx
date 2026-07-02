import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getBusiness, imageUrl, type BusinessDetail } from "../lib/api";
import { C } from "../lib/theme";
import type { Nav } from "../lib/nav";

const DAYS: [string, string][] = [
  ["mon", "Pzt"],
  ["tue", "Sal"],
  ["wed", "Çar"],
  ["thu", "Per"],
  ["fri", "Cum"],
  ["sat", "Cmt"],
  ["sun", "Paz"],
];
const UNIT: Record<string, string> = {
  PER_M2: "/m²",
  PER_PIECE: "/adet",
  FLAT: "sabit",
};

export function ProfileScreen({ nav, id }: { nav: Nav; id: string }) {
  const [b, setB] = useState<BusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBusiness(id)
      .then(setB)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <ActivityIndicator style={{ marginTop: 60 }} color={C.brand} size="large" />
      </SafeAreaView>
    );
  }
  if (!b) {
    return (
      <SafeAreaView style={s.screen}>
        <TouchableOpacity onPress={nav.back} style={s.back}>
          <Text style={s.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={s.empty}>Halıcı bulunamadı.</Text>
      </SafeAreaView>
    );
  }

  const main = b.pricing.filter((p) => !p.isAddon);
  const addons = b.pricing.filter((p) => p.isAddon);
  const hours = b.workingHours ?? {};

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <TouchableOpacity onPress={nav.back} style={s.back}>
          <Text style={s.backText}>← Geri</Text>
        </TouchableOpacity>

        <Text style={s.title}>{b.name}</Text>
        <Text style={s.sub}>
          {b.district}, {b.city} · ★ {b.ratingAvg.toFixed(1)} ({b.ratingCount})
        </Text>

        {b.badges.length > 0 && (
          <View style={s.badges}>
            {b.badges.map((bg) => (
              <Text key={bg} style={s.badge}>
                {bg}
              </Text>
            ))}
          </View>
        )}

        {b.photos.length > 0 && (
          <View style={s.photoGrid}>
            {b.photos.map((p, i) => {
              const u = imageUrl(p.url);
              return (
                <View key={i} style={s.photo}>
                  {u && <Image source={{ uri: u }} style={s.photoImg} />}
                  <Text style={s.photoTag}>{p.isBefore ? "Öncesi" : "Sonrası"}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={s.deliveryBox}>
          <Text style={s.deliveryText}>
            🚚 Tahmini teslim:{" "}
            {b.deliveryMinDays != null && b.deliveryMaxDays != null
              ? `${b.deliveryMinDays}-${b.deliveryMaxDays} iş günü`
              : "Belirtilmedi"}
          </Text>
        </View>

        <Text style={s.h2}>Fiyatlandırma</Text>
        {main.map((p, i) => (
          <View key={i} style={s.priceRow}>
            <Text style={s.priceLabel}>{p.label}</Text>
            <Text style={s.priceVal}>
              {p.price} TL {UNIT[p.unit] ?? ""}
            </Text>
          </View>
        ))}
        {addons.length > 0 && (
          <>
            <Text style={s.h3}>Ek hizmetler</Text>
            {addons.map((p, i) => (
              <View key={i} style={s.priceRow}>
                <Text style={s.priceLabel}>{p.label}</Text>
                <Text style={s.priceVal}>
                  {p.price} TL {UNIT[p.unit] ?? ""}
                </Text>
              </View>
            ))}
          </>
        )}
        <Text style={s.note}>
          Kesin fiyat, halı alındıktan ve görüldükten sonra netleşir.
        </Text>

        <Text style={s.h2}>Çalışma Saatleri</Text>
        {DAYS.map(([k, label]) => {
          const h = hours[k];
          return (
            <View key={k} style={s.priceRow}>
              <Text style={s.priceLabel}>{label}</Text>
              <Text style={s.priceVal}>{h ? `${h.open} - ${h.close}` : "Kapalı"}</Text>
            </View>
          );
        })}

        {b.reviews.length > 0 && (
          <>
            <Text style={s.h2}>Yorumlar</Text>
            {b.reviews.map((rv, i) => (
              <View key={i} style={s.review}>
                <Text style={s.reviewTop}>
                  {rv.customerName} · {"★".repeat(rv.rating)}
                </Text>
                {rv.comment && <Text style={s.reviewText}>{rv.comment}</Text>}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={s.cta}>
        <TouchableOpacity
          style={s.ctaBtn}
          onPress={() =>
            nav.go({ name: "order", id: b.id, businessName: b.name })
          }
        >
          <Text style={s.ctaText}>Halımı Aldır</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  back: { marginBottom: 8 },
  backText: { color: C.brandDark, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "800", color: C.text },
  sub: { color: C.sub, marginTop: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  badge: {
    backgroundColor: C.brandLight,
    color: C.brandDark,
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  photo: {
    width: "47%",
    aspectRatio: 4 / 3,
    borderRadius: 10,
    backgroundColor: C.slateBg,
    overflow: "hidden",
  },
  photoImg: { width: "100%", height: "100%" },
  photoTag: {
    position: "absolute",
    left: 6,
    top: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    color: "#fff",
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  deliveryBox: {
    marginTop: 14,
    backgroundColor: C.brandLight,
    borderRadius: 10,
    padding: 10,
  },
  deliveryText: { color: C.brandDark, fontWeight: "600" },
  h2: { fontSize: 16, fontWeight: "700", color: C.text, marginTop: 22, marginBottom: 6 },
  h3: { fontSize: 13, fontWeight: "700", color: C.sub, marginTop: 12, marginBottom: 4 },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  priceLabel: { color: C.text },
  priceVal: { color: C.text, fontWeight: "600" },
  note: { color: C.sub, fontSize: 12, marginTop: 8 },
  review: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  reviewTop: { fontWeight: "600", color: C.text },
  reviewText: { color: C.sub, marginTop: 4 },
  empty: { textAlign: "center", marginTop: 40, color: C.sub },
  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: "#fff",
  },
  ctaBtn: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
