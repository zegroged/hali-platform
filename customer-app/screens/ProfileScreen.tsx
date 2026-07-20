import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { getBusiness, imageUrl, type BusinessDetail } from "../lib/api";
import { whatsappHref } from "../lib/phone";
import { C } from "../lib/theme";
import type { Nav } from "../lib/nav";

/** m² hesaplayıcı — webdeki PriceEstimator'ın RN karşılığı. */
function PriceEstimator({ prices }: { prices: number[] }) {
  const [m2, setM2] = useState("");
  const val = Number(m2.replace(",", "."));
  const ok = Number.isFinite(val) && val > 0 && val <= 1000;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const fmt = (n: number) =>
    n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
  return (
    <View style={est.box}>
      <Text style={est.title}>Kaça gelir? Halının m²&apos;sini gir</Text>
      <View style={est.row}>
        <TextInput
          style={est.input}
          keyboardType="decimal-pad"
          placeholder="örn. 12"
          value={m2}
          onChangeText={setM2}
        />
        <Text style={est.unit}>m²</Text>
        {ok && (
          <Text style={est.result}>
            ≈ {min === max ? fmt(min * val) : `${fmt(min * val)}–${fmt(max * val)}`}{" "}
            TL
          </Text>
        )}
      </View>
      <Text style={est.note}>
        Tahminî tutardır; kesin fiyat halın ölçülünce bildirilir, onaylamazsan
        ücretsiz iade edilir.
      </Text>
    </View>
  );
}

const est = StyleSheet.create({
  box: {
    marginTop: 10,
    backgroundColor: C.brandLight,
    borderRadius: 10,
    padding: 12,
  },
  title: { fontWeight: "700", color: C.text, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  input: {
    width: 90,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  unit: { color: C.sub },
  result: { marginLeft: "auto", fontWeight: "800", color: C.brandDark },
  note: { color: C.sub, fontSize: 11, marginTop: 8 },
});

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

// Rozet kodları → Türkçe etiket (web src/components/Badges.tsx ile senkron).
// INSURED "Sigortalı" DEĞİL: gerçek poliçe yok, "Sigortalı" 6502 md.61/62
// yanıltıcı ticari uygulama sayılır → "Fotoğraflı Güvence" (Koşullar §5/C).
const BADGE_LABEL: Record<string, string> = {
  VERIFIED: "✓ Doğrulanmış",
  INSURED: "🛡 Fotoğraflı Güvence",
  FAST_DELIVERY: "⚡ Hızlı Teslim",
  TOP_RATED: "★ Çok Tercih Edilen",
  FAST_RESPONDER: "👍 Güvenilir",
};

export function ProfileScreen({ nav, id }: { nav: Nav; id: string }) {
  const [b, setB] = useState<BusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false); // ağ hatası ≠ "bulunamadı"
  const [attempt, setAttempt] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    getBusiness(id)
      .then(setB)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [id, attempt]);

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <ActivityIndicator style={{ marginTop: 60 }} color={C.brand} size="large" />
      </SafeAreaView>
    );
  }
  if (failed || !b) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={{ padding: 16 }}>
          <TouchableOpacity onPress={nav.back} style={s.back}>
            <Text style={s.backText}>← Geri</Text>
          </TouchableOpacity>
          <Text style={s.empty}>
            {failed
              ? "Bağlantı kurulamadı — interneti kontrol edip tekrar dene."
              : "Halıcı bulunamadı."}
          </Text>
          {failed && (
            <TouchableOpacity
              style={s.retryBtn}
              accessibilityRole="button"
              onPress={() => setAttempt((a) => a + 1)}
            >
              <Text style={s.retryText}>Tekrar dene</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const main = b.pricing.filter((p) => !p.isAddon);
  const addons = b.pricing.filter((p) => p.isAddon);
  const hours = b.workingHours ?? {};
  const m2Prices = main.filter((p) => p.unit === "PER_M2").map((p) => p.price);
  // Tatil modu: dolu ve gelecekteyse sipariş butonu kapanır.
  const paused = !!b.pausedUntil && new Date(b.pausedUntil) > new Date();
  const pausedLabel = paused
    ? new Date(b.pausedUntil!).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
      })
    : null;
  // WhatsApp yalnız CEP numarasında (sabit hatta WhatsApp yok → buton gizlenir,
  // kırık wa.me linki oluşmaz; web ile aynı kural). Birincil cep değilse
  // ikinci GSM'e düşer — web halici/[id] waHref İKİZİ.
  const waMsg = "Merhaba, halı yıkama hizmetiniz için yazıyorum.";
  const waHref =
    whatsappHref(b.phone, waMsg) ??
    (b.gsmPhone2 ? whatsappHref(b.gsmPhone2, waMsg) : null);

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <TouchableOpacity onPress={nav.back} style={s.back}>
          <Text style={s.backText}>← Geri</Text>
        </TouchableOpacity>

        <Text style={s.title}>{b.name}</Text>
        <Text style={s.sub}>
          {b.district}, {b.city}
          {b.ratingCount > 0
            ? ` · ★ ${b.ratingAvg.toFixed(1)} (${b.ratingCount})`
            : " · Yeni işletme · henüz yorum yok"}
        </Text>

        {paused && (
          <View style={s.pausedBox}>
            <Text style={s.pausedText}>
              ⏸ Bu işletme {pausedLabel} tarihine kadar yeni sipariş almıyor.
            </Text>
          </View>
        )}

        {b.badges.length > 0 && (
          <View style={s.badges}>
            {b.badges.map((bg) => (
              <Text key={bg} style={s.badge}>
                {BADGE_LABEL[bg] ?? bg}
              </Text>
            ))}
          </View>
        )}

        {!!b.description && <Text style={s.desc}>{b.description}</Text>}

        {/* İşletme Bilgileri — sipariş ÖNCESİ açık adres + tıklanır telefon
            (Mesafeli Söz. Yön. md.5/1-c; VKN ETAHS md.5/2). */}
        <View style={s.infoBox}>
          <Text style={s.infoTitle}>İşletme Bilgileri</Text>
          <Text style={s.infoRow}>📍 {b.address}</Text>
          {/* Numara grupları — web İKİZİ (halici/[id] İşletme Bilgileri):
              sabit hat ayrı satır, GSM'ler tek etiket altında tıklanır. */}
          {!!b.landlinePhone && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => Linking.openURL(`tel:${b.landlinePhone}`)}
            >
              <Text style={[s.infoRow, { color: C.brand }]}>
                ☎️ Sabit Hat: {b.landlinePhone}
              </Text>
            </TouchableOpacity>
          )}
          {[b.phone, ...(b.gsmPhone2 ? [b.gsmPhone2] : [])].map((num) => (
            <TouchableOpacity
              key={num}
              accessibilityRole="button"
              onPress={() => Linking.openURL(`tel:${num}`)}
            >
              <Text style={[s.infoRow, { color: C.brand }]}>📞 {num}</Text>
            </TouchableOpacity>
          ))}
          {!!b.taxNumber && (
            <Text style={s.infoRow}>Vergi No: {b.taxNumber}</Text>
          )}
          <Text style={s.infoNote}>
            İletişim bilgileri platform tarafından doğrulanmıştır.
          </Text>
        </View>

        {b.photos.length > 0 && (
          <View style={s.photoGrid}>
            {b.photos.map((p, i) => {
              const u = imageUrl(p.url);
              return (
                <View key={i} style={s.photo}>
                  {u && <Image source={{ uri: u }} style={s.photoImg} />}
                  {(p.isBefore || p.isAfter) && (
                    <Text style={s.photoTag}>
                      {p.isBefore ? "Öncesi" : "Sonrası"}
                    </Text>
                  )}
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
        {m2Prices.length > 0 && <PriceEstimator prices={m2Prices} />}

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

        <View style={s.reviewHead}>
          <Text style={s.h2}>Yorumlar</Text>
          {!!b.googleProfileUrl && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => Linking.openURL(b.googleProfileUrl!)}
            >
              <Text style={s.googleLink}>Google Yorumları →</Text>
            </TouchableOpacity>
          )}
        </View>
        {b.reviews.length > 0 ? (
          b.reviews.map((rv, i) => (
            <View key={i} style={s.review}>
              <Text style={s.reviewTop}>
                {rv.customerName} · {"★".repeat(rv.rating)}
              </Text>
              {rv.comment && <Text style={s.reviewText}>{rv.comment}</Text>}
            </View>
          ))
        ) : (
          <Text style={s.reviewEmpty}>Henüz yorum yok — ilk yorumu sen bırak.</Text>
        )}
      </ScrollView>

      {/* Alt çubuk home-indicator'lı cihazlarda ezilmesin (safe-area) */}
      <View style={[s.cta, { paddingBottom: 14 + insets.bottom }]}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {waHref && (
            <TouchableOpacity
              style={s.waBtn}
              onPress={() => Linking.openURL(waHref)}
              accessibilityLabel="WhatsApp'tan yaz"
            >
              <Text style={s.waText}>💬</Text>
            </TouchableOpacity>
          )}
          {paused ? (
            <View style={s.ctaPaused}>
              <Text style={s.ctaPausedText}>
                {pausedLabel} tarihine kadar sipariş almıyor
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.ctaBtn, { flex: 1 }]}
              onPress={() =>
                nav.go({ name: "order", id: b.id, businessName: b.name })
              }
            >
              <Text style={s.ctaText}>Halımı Aldır</Text>
            </TouchableOpacity>
          )}
        </View>
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
  desc: { color: C.text, marginTop: 10, lineHeight: 20 },
  infoBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    gap: 3,
  },
  infoTitle: { fontWeight: "700", color: C.text, marginBottom: 2 },
  infoRow: { color: C.text, fontSize: 14 },
  infoNote: { color: C.sub, fontSize: 12, marginTop: 4 },
  reviewHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
  },
  googleLink: { color: C.brandDark, fontWeight: "600", fontSize: 13 },
  reviewEmpty: { color: C.sub, marginTop: 8 },
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
  waBtn: {
    width: 54,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
  },
  waText: { fontSize: 22 },
  ctaPaused: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fcd34d",
    backgroundColor: "#fffbeb",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  ctaPausedText: {
    color: "#92400e",
    fontWeight: "600",
    fontSize: 13,
    textAlign: "center",
  },
  pausedBox: {
    marginTop: 10,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 10,
    padding: 10,
  },
  pausedText: { color: "#92400e", fontWeight: "600", fontSize: 13 },
  retryBtn: {
    alignSelf: "center",
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.brand,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: C.brandDark, fontWeight: "700" },
});
