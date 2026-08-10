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
import * as ImageManipulator from "expo-image-manipulator";
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

/**
 * Halı fotoğrafı çek.
 *
 * 🔴 SESSİZ BAŞARISIZLIK KAPATILDI (2026-08-06). Kullanıcı canlıda
 * *"halıyı aldım deyince fotoğraf yüklenmiyor"* dedi. Sunucu tarafı curl ile
 * RN'in gönderdiği multipart biçimiyle sınandı: **200 `{ok:true}`** — yani
 * sunucu sağlam, hata çekim adımındaydı. Ama eski kod her başarısızlıkta
 * `return null` yapıyor, çağıran da `if (!uri) return` ile SESSİZCE çıkıyordu:
 * şoför butona basıyor, kamera açılıp kapanıyor, **hiçbir şey olmuyor** ve
 * neyin ters gittiğini ne o ne biz öğrenebiliyorduk.
 *
 * Artık her dal konuşuyor. `iptal` ayrı işaretleniyor çünkü kullanıcının
 * kendi vazgeçmesi hata değildir — onda uyarı gösterilmez.
 */
type FotoSonuc =
  | { ok: true; uri: string }
  | { ok: false; iptal: true }
  | { ok: false; iptal?: false; hata: string };

async function takePhoto(): Promise<FotoSonuc> {
  let perm;
  try {
    perm = await ImagePicker.requestCameraPermissionsAsync();
  } catch (e) {
    return {
      ok: false,
      hata:
        "Kamera açılamadı: " +
        (e instanceof Error ? e.message : "bilinmeyen hata") +
        "\n\nTelefon ayarlarından uygulamaya kamera izni verip tekrar dene.",
    };
  }
  if (!perm.granted) {
    return {
      ok: false,
      hata: perm.canAskAgain
        ? "Kamera izni gerekli. Halının fotoğrafı hasar/kayıp kanıtıdır; izin vermeden alım yapılamıyor."
        : "Kamera izni KAPALI ve uygulama tekrar soramıyor. Telefon Ayarlar → Uygulamalar → Halı Şoför → İzinler → Kamera'yı aç.",
    };
  }

  let res;
  try {
    res = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      allowsEditing: false,
    });
  } catch (e) {
    return {
      ok: false,
      hata:
        "Kamera uygulaması açılamadı: " +
        (e instanceof Error ? e.message : "bilinmeyen hata"),
    };
  }

  if (res.canceled) return { ok: false, iptal: true };
  const uri = res.assets?.[0]?.uri;
  if (!uri) {
    // Buraya düşmek NADİR ama sessiz kalırsa teşhis edilemez: bazı cihazlarda
    // kamera fotoğrafı kaydedemeyip boş sonuç döndürüyor (depolama dolu vb.).
    return {
      ok: false,
      hata:
        "Kamera fotoğrafı döndürmedi. Telefonun depolaması dolu olabilir; yer açıp tekrar dene.",
    };
  }
  // 🔴 İNTERNET TÜKETİMİNİN EN BÜYÜK KALEMİ BURASIYDI (2026-08-10 ölçümü).
  //
  // `quality: 0.6` sıkıştırıyor ama BOYUT KÜÇÜLTMÜYOR: modern telefon kamerası
  // 4000×3000 çekiyor ve dosya 1,5-3 MB çıkıyor. Şoför her siparişte en az iki
  // kare çekiyor (alım + teslim); günde 10 sipariş = 30-60 MB. Şoförün kendi
  // hattından gidiyor ve fatura ona yazılıyor.
  //
  // Üstelik BOŞA gidiyordu: sunucu zaten 2560 px'e indirip WebP'ye çeviriyor
  // (api/panel/orders/[id]/photos). Yani telefon 3 MB yüklüyor, sunucu onu
  // atıp ~300 KB saklıyor. Aradaki fark tamamen israf.
  //
  // 1600 px uzun kenar: teslim/hasar kanıtı için fazlasıyla yeterli (yüzde
  // yüz yakınlaşmada bile leke görünür), dosya ~200-400 KB'ye iner — yaklaşık
  // 6-10 kat tasarruf.
  try {
    const kucuk = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
    );
    if (kucuk?.uri) return { ok: true, uri: kucuk.uri };
  } catch {
    // Küçültme başarısızsa ORİJİNALİ gönder — fotoğrafsız ilerlenemiyor,
    // veri tasarrufu uğruna işi durdurmak yanlış olur.
  }
  return { ok: true, uri };
}

export function Orders({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  // Alım anında girilen halı sayısı (2026-08-06) — sipariş kimliği başına.
  const [carpetCounts, setCarpetCounts] = useState<Record<string, string>>({});

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
    // 20 sn → 45 sn (2026-08-10, veri tasarrufu). Ekran açıkken saatte 180
    // istek atıyordu; 45 sn'de 80'e iner ve şoför farkı hissetmez (yeni iş
    // zaten PUSH ile bildiriliyor, ayrıca aşağı çekerek tazeleyebiliyor).
    const t = setInterval(fetchOrders, 45000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  // SÖZLÜ ONAY ARTIK SORULUYOR (2026-07-28 denetim — KRİTİK).
  //
  // Eskiden buton koşulsuz `advanceOrder(id, true)` gönderiyordu; sunucu da bunu
  // "İşletme beyanı: müşteriden sözlü fiyat/ifa onayı alındı" diye sipariş
  // geçmişine YAZIYORDU. Yani kimseye sorulmadan, sözleşmede md.15/1-h ispat
  // kaydı olarak tutulan bir beyan UYDURULUYORDU. Bir uyuşmazlıkta bu kayıt
  // bizim aleyhimize delil olurdu.
  //
  // Müşteri fiyatı uygulamadan onayladıysa (priceApprovedAt dolu) soru sorulmaz
  // — zaten dijital onay var. Yalnız onay YOKKEN şoföre sorulur ve NE DERSE O
  // kaydedilir.
  function yikamayaAl(o: DriverOrder) {
    if (o.status !== "PICKED_UP" || o.priceApprovedAt) {
      return run(o.id, () => advanceOrder(o.id, false));
    }
    Alert.alert(
      "Fiyat onayı",
      "Müşteri kesin fiyatı uygulamadan onaylamamış. Müşteri sana SÖZLÜ olarak onay verdi mi?\n\n" +
        "Verdiği gibi işaretle — bu kayıt anlaşmazlıkta delil olarak kullanılır.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Hayır, onay almadım",
          onPress: () => run(o.id, () => advanceOrder(o.id, false)),
        },
        {
          text: "Evet, sözlü onay aldım",
          onPress: () => run(o.id, () => advanceOrder(o.id, true)),
        },
      ],
    );
  }

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
    Alert.alert("Siparişi reddet — sebep?", "Müşteriye bu sebep iletilir.", [
      {
        text: "Yoğunluk / kapasite",
        onPress: () =>
          run(o.id, () => rejectOrder(o.id, "Yoğunluk / kapasite dolu")),
      },
      {
        text: "Hizmet bölgesi dışı",
        onPress: () => run(o.id, () => rejectOrder(o.id, "Hizmet bölgesi dışı")),
      },
      { text: "Vazgeç", style: "cancel" },
    ]);
  }

  /**
   * Fotoğraf çek ve sonucu KULLANICIYA ANLAT. Eskiden `if (!uri) return` ile
   * sessizce çıkılıyordu — şoför butona basıyor, hiçbir şey olmuyordu.
   * İptalde uyarı YOK (kullanıcı bilerek vazgeçti).
   */
  async function fotoAl(): Promise<string | null> {
    const r = await takePhoto();
    if (r.ok) return r.uri;
    if (!r.iptal) Alert.alert("Fotoğraf çekilemedi", r.hata);
    return null;
  }

  async function doPickup(o: DriverOrder) {
    // Kutuda GÖRÜNEN değerle GÖNDERİLEN değer aynı olmalı (teslim tutarında
    // yaşanan hatanın aynısına düşmemek için): boşsa undefined gider.
    const ham = (carpetCounts[o.id] ?? "").trim();
    const sayi = ham ? Number(ham) : undefined;
    if (sayi != null && (!Number.isInteger(sayi) || sayi < 1 || sayi > 100)) {
      Alert.alert("Halı sayısı", "1 ile 100 arasında bir sayı gir.");
      return;
    }
    const uri = await fotoAl();
    if (!uri) return;
    run(o.id, () => pickupOrder(o.id, uri, sayi));
  }

  async function doDeliver(o: DriverOrder) {
    // Kutuda GÖRÜNEN değerle GÖNDERİLEN değer aynı olmalı: şoför ön dolu tutara
    // dokunmadan "Teslim Et"e basarsa prices[o.id] boştur → aynı yedeğe düş.
    const girilen =
      prices[o.id] ?? (o.quotedPrice != null ? String(o.quotedPrice) : "");
    const price = Number(girilen.replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert("Tutar gerekli", "Tahsil edilen tutarı gir (0'dan büyük).");
      return;
    }
    const uri = await fotoAl();
    if (!uri) return;
    run(o.id, () => deliverOrder(o.id, price, uri));
  }

  // YOL TARİFİ (2026-08-10) — web ile İKİZ (src/app/sofor/page.tsx).
  //
  // ESKİSİ `maps/search` idi: adresi haritada GÖSTERİYOR ama navigasyonu
  // BAŞLATMIYORDU. Şoför haritayı açıyor, sonra elle "yol tarifi"ne basıp
  // hedefi yeniden seçmek zorunda kalıyordu — direksiyon başında.
  // `maps/dir` ise şoförün BULUNDUĞU konumdan hedefe sürüş tarifini doğrudan
  // açar (kaynak boş bırakılınca Google mevcut konumu alır).
  function mapUrl(o: DriverOrder): string {
    const hedef =
      o.pickupLat != null && o.pickupLng != null
        ? `${o.pickupLat},${o.pickupLng}`
        : encodeURIComponent(o.pickupAddress);
    return `https://www.google.com/maps/dir/?api=1&destination=${hedef}&travelmode=driving`;
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
        <View style={{ gap: 8 }}>
          {/* HALI SAYISI — ALIM ANINDA (2026-08-06, panel + şoför web ile İKİZ).
              Numaralar (1..N) buradan doğuyor. Öncesinde numara fotoğraftan
              doğuyordu: fotoğrafı çekilmeyen halı sistemde hiç yoktu ve
              "5 geldi, 5 gitti mi?" sorusu cevaplanamıyordu. Boş bırakılabilir
              (sunucu opsiyonel kabul eder) ama doldurmak asıl amaç. */}
          <TextInput
            style={s.input}
            placeholder="Kaç halı aldın? (örn. 5)"
            keyboardType="number-pad"
            value={carpetCounts[o.id] ?? ""}
            onChangeText={(v) =>
              setCarpetCounts((p) => ({ ...p, [o.id]: v.replace(/\D/g, "") }))
            }
          />
          <TouchableOpacity
            style={[s.btn, busy && s.off]}
            disabled={busy}
            onPress={() => doPickup(o)}
          >
            <Text style={s.btnText}>📷 Halıyı Aldım (fotoğraf zorunlu)</Text>
          </TouchableOpacity>
        </View>
      );
    if (o.status === "PICKED_UP" || o.status === "WASHING")
      return (
        <TouchableOpacity
          style={[s.btn, busy && s.off]}
          disabled={busy}
          onPress={() => yikamayaAl(o)}
        >
          <Text style={s.btnText}>{ADVANCE_LABEL[o.status]}</Text>
        </TouchableOpacity>
      );
    if (o.status === "OUT_FOR_DELIVERY")
      return (
        <View style={{ gap: 8 }}>
          {/* Halıcının bildirdiği tutar HAZIR gelir (web şoför ekranıyla İKİZ,
              2026-07-26): şoför sıfırdan yazmasın, yanlış tahsilat olmasın.
              Şoför yine de üzerine yazabilir (fark çıkarsa). */}
          <TextInput
            style={s.input}
            placeholder="Tahsil edilen tutar (TL)"
            keyboardType="decimal-pad"
            value={
              prices[o.id] ??
              (o.quotedPrice != null ? String(o.quotedPrice) : "")
            }
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
          <Text style={s.addrPlain}>📍 {o.pickupAddress}</Text>
          {/* AÇIK DÜĞME (2026-08-10) — web'de zaten böyleydi (sofor/page.tsx).
              Mobilde tek dokunma hedefi ADRES METNİYDİ: direksiyon başındaki
              şoför onun tıklanabilir olduğunu görmüyordu. Şoförün en çok
              kullandığı işlem yol tarifi; düğme olarak duruyor. */}
          <View style={[s.row, { marginTop: 8 }]}>
            <TouchableOpacity
              style={[s.btn, s.btnNav]}
              onPress={() => Linking.openURL(mapUrl(o))}
              accessibilityRole="button"
              accessibilityLabel="Yol tarifi başlat"
            >
              <Text style={s.btnNavText}>🧭 Yol Tarifi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.btnCall]}
              onPress={() => Linking.openURL(`tel:${o.customerPhone}`)}
              accessibilityRole="button"
              accessibilityLabel="Müşteriyi ara"
            >
              <Text style={s.btnCallText}>📞 Ara</Text>
            </TouchableOpacity>
          </View>
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
  // Adres artık DÜĞME değil düz metin (dokunma hedefi aşağıdaki butonlarda).
  addrPlain: { color: "#334155", marginTop: 2 },
  btnNav: { backgroundColor: "#0d9488", flex: 1 },
  btnNavText: { color: "#fff", fontWeight: "700" },
  btnCall: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", flex: 1 },
  btnCallText: { color: "#334155", fontWeight: "700" },
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
