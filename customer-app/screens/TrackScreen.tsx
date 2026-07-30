import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import {
  getTracking,
  approvePrice,
  cancelOrder,
  submitReview,
  imageUrl,
  ApiError,
  CANCEL_REASONS,
  type Tracking,
} from "../lib/api";
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

// Platform üzerinden iptal yalnız halı alınmadan (web ile aynı kural, md.11/5).
const CANCELABLE = ["CREATED", "ACCEPTED"];
// Nihai durumlarda polling durur (web FINAL_STATUSES ile aynı).
const FINAL = ["DELIVERED", "REJECTED", "CANCELED"];

export function TrackScreen({
  nav,
  code,
  token,
}: {
  nav: Nav;
  code?: string;
  token?: string;
}) {
  // Kod BÜYÜK harfe çevrilmez: takip linkindeki token küçük harfli cuid'dir,
  // sunucu code'u zaten kendisi uppercase'ler.
  const [input, setInput] = useState(code ?? "");
  const [activeCode, setActiveCode] = useState(code?.trim() ?? "");
  // API ANAHTARI: sipariş sonrası UZUN token verilir (kesin-fiyat onayı/iptal
  // bununla çalışır); yoksa elle girilen kısa kod (yalnız salt-okunur takip).
  const apiKey = token ?? activeCode;
  const [data, setData] = useState<Tracking | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState("");
  // Değerlendirme (teslim sonrası)
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async (c: string) => {
    if (busyRef.current) return; // aksiyon sürerken poll durumu ezmesin
    try {
      const t = await getTracking(c.trim());
      if (t) {
        setData(t);
        setNotFound(false);
        // Nihai durumda sonsuza dek sorgulama (rate limit + pil).
        if (FINAL.includes(t.status) && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } else {
        setData(null);
        setNotFound(true);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch {
      // Geçici hata (429/5xx/ağ): mevcut görünümü KORU — "bulunamadı" deme.
    }
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    load(apiKey);
    pollRef.current = setInterval(() => load(apiKey), 6000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [apiKey, load]);

  async function onApprovePrice() {
    setBusy(true);
    busyRef.current = true;
    let okMsg: string | null = null;
    try {
      await approvePrice(apiKey);
      okMsg = "Fiyat onayın işletmeye iletildi — yıkama başlıyor.";
    } catch (e) {
      Alert.alert(
        "Olmadı",
        e instanceof ApiError ? e.message : "Bağlantı hatası — tekrar dene.",
      );
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
    // Yenileme ayrı: aksiyon BAŞARILI olduysa refresh hatası yanlış
    // "onaylanamadı" uyarısına dönüşmesin.
    if (okMsg) {
      Alert.alert("Onaylandı", okMsg);
      load(apiKey);
    }
  }

  async function onCancelConfirm() {
    if (!cancelReason) return;
    setBusy(true);
    busyRef.current = true;
    let ok = false;
    try {
      await cancelOrder(apiKey, cancelReason, cancelNote || undefined);
      ok = true;
    } catch (e) {
      Alert.alert(
        "İptal edilemedi",
        e instanceof ApiError ? e.message : "Bağlantı hatası — tekrar dene.",
      );
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
    if (ok) {
      setShowCancel(false);
      Alert.alert(
        "İptal edildi",
        "Cayma bildirimin işletmeye iletildi. Ücret talep edilmez.",
      );
      load(apiKey);
    }
  }

  async function onSubmitReview() {
    if (reviewRating < 1) {
      Alert.alert("Puan gerekli", "Lütfen 1-5 arası bir yıldız seç.");
      return;
    }
    setReviewBusy(true);
    busyRef.current = true;
    let ok = false;
    try {
      await submitReview(apiKey, reviewRating, reviewComment.trim() || undefined);
      ok = true;
    } catch (e) {
      Alert.alert(
        "Gönderilemedi",
        e instanceof ApiError ? e.message : "Bağlantı hatası — tekrar dene.",
      );
    } finally {
      setReviewBusy(false);
      busyRef.current = false;
    }
    if (ok) {
      Alert.alert("Teşekkürler", "Değerlendirmen kaydedildi.");
      load(apiKey);
    }
  }

  const currentIdx = data ? FLOW.findIndex((f) => f[0] === data.status) : -1;
  const rejected = data?.status === "REJECTED";
  const canceled = data?.status === "CANCELED";
  // md.15/1-h: kesin fiyat bildirildi, DİJİTAL onay bekleniyor — yalnız
  // PICKED_UP'ta (sunucu başka durumda onayı reddeder; web ile aynı kapı).
  // Kesin-fiyat onayı ve iptal yalnız TAM ERİŞİMLE (uzun token) yapılabilir.
  // Elle kısa kod girildiyse fullAccess=false → butonlar gizlenir, net not çıkar
  // (web'deki fullAccess kapısıyla birebir; kısa kodla 403 hatası yerine).
  const fullAccess = data?.fullAccess !== false; // undefined (eski) → izin
  const pricePending =
    !!data &&
    data.status === "PICKED_UP" &&
    data.quotedPrice != null &&
    data.priceApprovedAt == null;
  const needsPriceApproval = pricePending && fullAccess;
  const priceApproved =
    !!data && data.quotedPrice != null && data.priceApprovedAt != null;
  const cancelable = !!data && CANCELABLE.includes(data.status);
  const canCancel = cancelable && fullAccess;
  // Aksiyon mümkün AMA tam erişim yok (elle kısa kod ile bakılıyor).
  const actionNeedsToken = (pricePending || cancelable) && !fullAccess;
  const alternatives = data?.alternatives ?? [];

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={nav.back} accessibilityRole="button">
          <Text style={s.back}>← Geri</Text>
        </TouchableOpacity>
        <Text style={s.title}>📦 Sipariş Takibi</Text>

        <View style={s.searchRow}>
          <TextInput
            style={s.input}
            placeholder="Takip kodu"
            autoCapitalize="characters"
            autoCorrect={false}
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity
            style={s.btn}
            accessibilityRole="button"
            onPress={() => {
              setNotFound(false);
              setActiveCode(input.trim());
            }}
          >
            <Text style={s.btnText}>Takip Et</Text>
          </TouchableOpacity>
        </View>

        {notFound && <Text style={s.empty}>Bu kodla sipariş bulunamadı.</Text>}

        {data && (
          <View style={{ marginTop: 18 }}>
            <Text style={s.biz}>{data.business.name}</Text>

            {/* Halıcıyla iletişim — webdeki "Halıcıyı Ara" karşılığı */}
            {!!data.business.phone && (
              <TouchableOpacity
                style={s.callBtn}
                accessibilityRole="button"
                onPress={() => Linking.openURL(`tel:${data.business.phone}`)}
              >
                <Text style={s.callText}>
                  📞 Halıcıyı Ara · {data.business.phone}
                </Text>
              </TouchableOpacity>
            )}

            {/* SLA: 24 saattir yanıtsız — beklemek zorunda değilsin */}
            {data.waitingLong && !rejected && !canceled && (
              <View style={s.warnBox}>
                <Text style={s.warnTitle}>
                  İşletme siparişini henüz yanıtlamadı
                </Text>
                <Text style={s.warnText}>
                  24 saati geçti. İstersen aşağıdan ücretsiz iptal edip başka
                  bir halıcı seçebilirsin.
                </Text>
              </View>
            )}

            {rejected ? (
              <View style={s.rejected}>
                <Text style={s.rejectedTitle}>Talep reddedildi</Text>
                {data.rejectReason && (
                  <Text style={s.rejectedReason}>Sebep: {data.rejectReason}</Text>
                )}
              </View>
            ) : canceled ? (
              <View style={s.canceledBox}>
                <Text style={s.canceledText}>
                  Bu talep iptal edildi. Ücret talep edilmez.
                </Text>
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

            {/* Elle kısa kodla bakılıyor → onay/iptal için tam erişim gerekli */}
            {actionNeedsToken && (
              <View style={s.warnBox}>
                <Text style={s.warnTitle}>
                  {pricePending
                    ? "Kesin fiyat onayı bekliyor"
                    : "Bu siparişi iptal edebilirsin"}
                </Text>
                <Text style={s.warnText}>
                  Fiyat onayı ve iptal için siparişi <Text style={{ fontWeight: "700" }}>verdiğin
                  cihazdaki takip ekranından</Text> devam et. Güvenlik için kısa
                  takip koduyla bu işlemler yapılamaz.
                </Text>
              </View>
            )}

            {/* md.15/1-h: KESİN FİYAT ONAYI — yıkama ancak onayla başlar */}
            {needsPriceApproval && (
              <View style={s.priceApproveBox}>
                <Text style={s.priceApproveTitle}>
                  Kesin fiyat bildirildi: {data.quotedPrice} TL
                </Text>
                <Text style={s.priceApproveText}>
                  Halın ölçüldü. Onaylarsan yıkamaya başlanır; onaylamazsan
                  halın YIKANMADAN ücretsiz geri getirilir (işletmeyi arayarak
                  da bildirebilirsin).
                </Text>
                <TouchableOpacity
                  style={s.approveBtn}
                  accessibilityRole="button"
                  onPress={onApprovePrice}
                  disabled={busy}
                >
                  <Text style={s.approveText}>
                    {busy ? "Gönderiliyor…" : `Fiyatı Onayla — ${data.quotedPrice} TL`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Onay sonrası kalıcı teyit (ispat görünümü) */}
            {priceApproved && !rejected && !canceled && (
              <View style={s.approvedLine}>
                <Text style={s.approvedLineText}>
                  ✓ Kesin fiyatı onayladın: {data.quotedPrice} TL
                </Text>
              </View>
            )}

            {/* DEĞERLENDİRME — teslim edildiyse (web TrackingClient ile aynı) */}
            {data.status === "DELIVERED" && (
              <View style={s.reviewBox}>
                {data.review ? (
                  <Text style={s.reviewDone}>
                    ⭐ Değerlendirdin: {"★".repeat(data.review.rating)} — teşekkürler!
                  </Text>
                ) : data.viewerIsCustomer ? (
                  <>
                    <Text style={s.reviewTitle}>Hizmeti değerlendir</Text>
                    <View style={s.stars}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => setReviewRating(n)}
                          accessibilityRole="button"
                          accessibilityLabel={`${n} yıldız`}
                        >
                          <Text style={s.star}>
                            {n <= reviewRating ? "★" : "☆"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={s.reviewInput}
                      placeholder="Yorumun (opsiyonel)"
                      multiline
                      maxLength={500}
                      value={reviewComment}
                      onChangeText={setReviewComment}
                    />
                    <TouchableOpacity
                      style={[s.approveBtn, reviewBusy && { opacity: 0.6 }]}
                      onPress={onSubmitReview}
                      disabled={reviewBusy}
                    >
                      <Text style={s.approveText}>
                        {reviewBusy ? "Gönderiliyor…" : "Değerlendirmeyi Gönder"}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={s.reviewTitle}>Hizmeti değerlendirmek ister misin?</Text>
                    <Text style={s.reviewHint}>
                      Değerlendirme yapmak için üye girişi gerekir (siparişi veren
                      hesapla).
                    </Text>
                    <TouchableOpacity
                      style={s.approveBtn}
                      onPress={() => nav.go({ name: "auth" })}
                    >
                      <Text style={s.approveText}>Giriş Yap / Üye Ol</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* Tahmini teslim süresi */}
            {data.estimatedDays != null &&
              !rejected &&
              !canceled &&
              data.status !== "DELIVERED" && (
                <View style={s.priceBox}>
                  <Text style={s.priceText}>
                    Tahmini teslim: ~{data.estimatedDays} gün
                  </Text>
                </View>
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

            {/* Halıcının eklediği fotoğraflar */}
            {data.photos.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={s.h3}>Halınızdan kareler</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {data.photos.map((p) => {
                      const u = imageUrl(p.url);
                      // Aşama etiketi (web takip sayfasıyla aynı sözlük):
                      // müşteri hangi karenin ne zamana ait olduğunu görsün.
                      const asama =
                        p.stage === "ALIM"
                          ? "Alım"
                          : p.stage === "YIKAMA"
                            ? "Yıkama"
                            : p.stage === "TESLIM"
                              ? "Teslim"
                              : null;
                      return (
                        u && (
                          <View key={p.id}>
                            <Image source={{ uri: u }} style={s.orderPhoto} />
                            {asama && (
                              <Text style={s.orderPhotoStage}>{asama}</Text>
                            )}
                          </View>
                        )
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {data.priceTotal != null && (
              <View style={s.priceBox}>
                <Text style={s.priceText}>
                  Tutar: {data.priceTotal} TL ·{" "}
                  {data.paymentMethod === "CARD" ? "Kartla ödeme" : "Kapıda nakit"}
                </Text>
              </View>
            )}

            {/* Kurtarma: red/iptal/uzun beklemede aynı şehirden alternatifler */}
            {(rejected || canceled || data.waitingLong) &&
              alternatives.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={s.h3}>Bölgendeki diğer halıcılar</Text>
                  {alternatives.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={s.altCard}
                      accessibilityRole="button"
                      onPress={() => nav.go({ name: "profile", id: a.id })}
                    >
                      <Text style={s.altName}>{a.name}</Text>
                      <Text style={s.altSub}>
                        {a.district}
                        {a.ratingCount > 0
                          ? ` · ★ ${a.ratingAvg.toFixed(1)} (${a.ratingCount})`
                          : " · Yeni"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

            {/* İptal/cayma — yalnız halı alınmadan (md.11/5). İki adım:
                neden SEÇ + not → ayrı ONAY butonu (tek dokunuşla geri
                alınamaz iptal olmasın). */}
            {canCancel && !showCancel && (
              <TouchableOpacity
                style={s.cancelLink}
                accessibilityRole="button"
                onPress={() => setShowCancel(true)}
              >
                <Text style={s.cancelLinkText}>Siparişi iptal et</Text>
              </TouchableOpacity>
            )}
            {canCancel && showCancel && (
              <View style={s.cancelBox}>
                <Text style={s.h3}>Neden iptal ediyorsun?</Text>
                {CANCEL_REASONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[s.reasonBtn, cancelReason === r && s.reasonOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: cancelReason === r }}
                    onPress={() => setCancelReason(r)}
                  >
                    <Text
                      style={cancelReason === r ? s.reasonTextOn : s.reasonText}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={[s.input, { marginTop: 10, letterSpacing: 0 }]}
                  placeholder="Not (opsiyonel)"
                  value={cancelNote}
                  onChangeText={setCancelNote}
                  maxLength={300}
                />
                <TouchableOpacity
                  style={[s.confirmCancelBtn, (!cancelReason || busy) && { opacity: 0.5 }]}
                  accessibilityRole="button"
                  disabled={!cancelReason || busy}
                  onPress={onCancelConfirm}
                >
                  <Text style={s.confirmCancelText}>
                    {busy ? "İptal ediliyor…" : "Evet, siparişi iptal et"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => {
                    setShowCancel(false);
                    setCancelReason(null);
                  }}
                >
                  <Text style={s.cancelDismiss}>Vazgeç, iptal etme</Text>
                </TouchableOpacity>
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
  callBtn: {
    borderWidth: 1,
    borderColor: C.brand,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  callText: { color: C.brandDark, fontWeight: "600" },
  step: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotOn: { backgroundColor: C.brand },
  dotOff: { backgroundColor: C.border },
  stepOn: { color: C.text, fontWeight: "600" },
  stepOff: { color: C.sub },
  driverText: { color: C.brandDark, fontWeight: "600" },
  h3: { fontWeight: "700", color: C.text, marginBottom: 6 },
  rejected: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12,
  },
  rejectedTitle: { color: "#b91c1c", fontWeight: "700" },
  rejectedReason: { color: "#dc2626", marginTop: 4 },
  canceledBox: {
    backgroundColor: C.slateBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
  },
  canceledText: { color: C.sub },
  warnBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  warnTitle: { color: "#92400e", fontWeight: "700" },
  warnText: { color: "#92400e", marginTop: 4, fontSize: 13 },
  priceApproveBox: {
    marginTop: 14,
    backgroundColor: C.brandLight,
    borderWidth: 1,
    borderColor: C.brand,
    borderRadius: 12,
    padding: 14,
  },
  priceApproveTitle: { color: C.brandDark, fontWeight: "800", fontSize: 16 },
  priceApproveText: { color: C.brandDark, marginTop: 6, fontSize: 13, lineHeight: 19 },
  approveBtn: {
    backgroundColor: C.brand,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 12,
  },
  approveText: { color: "#fff", fontWeight: "700" },
  reviewBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  reviewTitle: { fontWeight: "700", color: C.text, fontSize: 15 },
  reviewHint: { color: C.sub, fontSize: 13, marginTop: 4 },
  reviewDone: { color: C.green, fontWeight: "600", fontSize: 15 },
  stars: { flexDirection: "row", gap: 6, marginTop: 8, marginBottom: 4 },
  star: { fontSize: 32, color: C.amber },
  reviewInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fff",
    marginTop: 8,
    height: 64,
  },
  approvedLine: {
    marginTop: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 10,
    padding: 10,
  },
  approvedLineText: { color: "#047857", fontWeight: "600", fontSize: 13 },
  priceBox: {
    marginTop: 14,
    backgroundColor: C.brandLight,
    borderRadius: 10,
    padding: 12,
  },
  priceText: { color: C.brandDark, fontWeight: "600" },
  orderPhoto: { width: 110, height: 110, borderRadius: 10, backgroundColor: C.slateBg },
  orderPhotoStage: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: C.brandDark,
    textAlign: "center",
  },
  altCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  altName: { fontWeight: "700", color: C.text },
  altSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  cancelLink: { marginTop: 20, alignItems: "center" },
  cancelLinkText: { color: "#b91c1c", fontWeight: "600" },
  cancelBox: {
    marginTop: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
  },
  reasonBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 8,
  },
  reasonOn: { borderColor: C.brand, backgroundColor: C.brandLight },
  reasonText: { color: C.text, fontWeight: "600" },
  reasonTextOn: { color: C.brandDark, fontWeight: "700" },
  confirmCancelBtn: {
    backgroundColor: "#b91c1c",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  confirmCancelText: { color: "#fff", fontWeight: "700" },
  cancelDismiss: {
    textAlign: "center",
    color: C.sub,
    marginTop: 12,
    fontWeight: "600",
  },
});
