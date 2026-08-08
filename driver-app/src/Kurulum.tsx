import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import {
  pilMuafiyetiIste,
  pilAyarListesiniAc,
  uygulamaAyarlariniAc,
  konumAyarlariniAc,
} from "./pil";
import { konumServisiAcikMi } from "./tracking";

// KURULUM EKRANI (2026-08-08, işletme sahibi isteği: "izinleri tek tıkla bir
// kez alsın, sonsuz gün kalsın").
//
// 🔑 DÜRÜST SINIR — "tek tık" Android'de MÜMKÜN DEĞİL:
//   · Konum (uygulama açıkken) → tek sistem diyaloğu ✔
//   · Bildirim               → tek sistem diyaloğu ✔
//   · Pil muafiyeti          → tek sistem diyaloğu ✔ (ama HiOS yutabiliyor)
//   · ARKA PLAN KONUMU       → Android 11'den beri uygulama içi diyalogla
//     VERİLEMEZ. Sistem yalnız "Uygulamayı kullanırken" sunar; "Her zaman"
//     için kullanıcı AYARLAR'a gitmek ZORUNDA. Bu bizim eksiğimiz değil,
//     Google'ın kuralı — hiçbir uygulama atlayamaz.
//   · HiOS "otomatik başlatma" → hiçbir genel API yok, yalnız elle.
//
// O yüzden hedef "tek tık" değil, TEK AKIŞ: şoför bir kez buradan geçer,
// her adımın durumunu görür, bir daha sorulmaz.

type AdimDurum = "bilinmiyor" | "tamam" | "eksik";

function Satir({
  no,
  baslik,
  aciklama,
  durum,
  dugme,
  onPress,
}: {
  no: number;
  baslik: string;
  aciklama: string;
  durum: AdimDurum;
  dugme: string;
  onPress: () => void;
}) {
  return (
    <View style={s.kart}>
      <View style={s.basSatir}>
        <Text style={s.no}>{no}</Text>
        <Text style={s.baslik}>{baslik}</Text>
        <Text style={[s.rozet, durum === "tamam" ? s.rozetOk : durum === "eksik" ? s.rozetKotu : s.rozetGri]}>
          {durum === "tamam" ? "✓ Tamam" : durum === "eksik" ? "Gerekli" : "—"}
        </Text>
      </View>
      <Text style={s.aciklama}>{aciklama}</Text>
      {durum !== "tamam" && (
        <TouchableOpacity style={s.dugme} onPress={onPress}>
          <Text style={s.dugmeYazi}>{dugme}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function Kurulum({
  paket,
  onBitti,
}: {
  paket: string;
  onBitti: () => void;
}) {
  const [servis, setServis] = useState<AdimDurum>("bilinmiyor");
  const [onIzin, setOnIzin] = useState<AdimDurum>("bilinmiyor");
  const [arkaIzin, setArkaIzin] = useState<AdimDurum>("bilinmiyor");
  const [bildirim, setBildirim] = useState<AdimDurum>("bilinmiyor");

  const durumlariOku = useCallback(async () => {
    try {
      // TELEFONUN KONUM ANAHTARI — izinden AYRI. Kapalıyken izinler "verildi"
      // görünür ama tek konum üretilmez; mesai düğmesi de bu yüzden engelliyor.
      setServis((await konumServisiAcikMi()) ? "tamam" : "eksik");
      const fg = await Location.getForegroundPermissionsAsync();
      setOnIzin(fg.status === "granted" ? "tamam" : "eksik");
      const bg = await Location.getBackgroundPermissionsAsync();
      setArkaIzin(bg.status === "granted" ? "tamam" : "eksik");
      const nt = await Notifications.getPermissionsAsync();
      setBildirim(nt.status === "granted" ? "tamam" : "eksik");
    } catch {
      // okunamazsa ekran yine kullanılabilir kalsın
    }
  }, []);

  useEffect(() => {
    void durumlariOku();
  }, [durumlariOku]);

  async function konumIste() {
    await Location.requestForegroundPermissionsAsync();
    await durumlariOku();
  }

  async function arkaPlanIste() {
    const bg = await Location.requestBackgroundPermissionsAsync();
    await durumlariOku();
    if (bg.status !== "granted") {
      // Android 11+: diyalog "Her zaman"ı SUNMAZ. Şoförü çıkmazda bırakma —
      // nereye gideceğini yaz ve oraya götür.
      Alert.alert(
        "Ayarlardan seçmen gerekiyor",
        "Telefonun bunu uygulama içinden vermene izin vermiyor.\n\n" +
          "Açılacak ekranda:\nİzinler → Konum → “Her zaman izin ver”\n\n" +
          "Bu adım olmadan mesai sırasında ekran kapanınca konumun işletmene gitmez.",
        [
          { text: "Sonra", style: "cancel" },
          { text: "Ayarları aç", onPress: () => void uygulamaAyarlariniAc(paket) },
        ],
      );
    }
  }

  async function bildirimIste() {
    await Notifications.requestPermissionsAsync();
    await durumlariOku();
  }

  async function pilIste() {
    await pilMuafiyetiIste(paket);
    // Android muafiyet durumunu okumamıza izin vermiyor ve bazı telefonlar
    // (Tecno/HiOS) diyaloğu sessizce yutuyor → KULLANICIYA SOR. Eski sürüm
    // burada susuyordu ve düğme "çalışmıyor" görünüyordu.
    Alert.alert(
      "Ekran açıldı mı?",
      "“Halı Şoför uygulamasının pili kısıtlamadan çıkarılsın mı?” diye soran " +
        "bir pencere görüp İZİN VER dediysen bu adım tamam.\n\n" +
        "Hiçbir şey açılmadıysa telefonun bu pencereyi engelliyordur — " +
        "aşağıdaki düğmeyle listeden elle seçebilirsin.",
      [
        { text: "Açıldı, verdim", style: "cancel" },
        { text: "Açılmadı — listeyi aç", onPress: () => void pilAyarListesiniAc() },
      ],
    );
  }

  function otomatikBaslatma() {
    Alert.alert(
      "Otomatik başlatma (bu adım telefona özel)",
      "Bazı telefonlar (Tecno, Xiaomi, Oppo, Huawei…) uygulamayı arka planda " +
        "durdurur. Açılacak ekranda şunları ara ve AÇIK yap:\n\n" +
        "• “Otomatik başlat” / “Autostart”\n" +
        "• “Arka planda çalışmaya izin ver”\n" +
        "• Pil → “Kısıtlama yok” / “Sınırsız”\n\n" +
        "Bunlar kapalıysa mesai açıkken bile konumun birkaç dakika sonra kesilir.",
      [
        { text: "Sonra", style: "cancel" },
        { text: "Ayarları aç", onPress: () => void uygulamaAyarlariniAc(paket) },
      ],
    );
  }

  const zorunluTamam = servis === "tamam" && onIzin === "tamam" && arkaIzin === "tamam";

  return (
    <ScrollView style={s.kok} contentContainerStyle={s.icerik}>
      <Text style={s.ustBaslik}>Kurulum</Text>
      <Text style={s.ustAciklama}>
        Bunları bir kez yap, bir daha sorulmaz. Eksik kalırsa mesai sırasında
        konumun işletmene gitmez ve sen bunu fark etmezsin.
      </Text>

      <Satir
        no={1}
        baslik="Telefonun konumu"
        aciklama="Telefonun GPS anahtarı. Kapalıyken mesaiye başlayamazsın — izin verilse bile hiç konum üretilmez."
        durum={servis}
        dugme="Konum ayarlarını aç"
        onPress={async () => {
          await konumAyarlariniAc();
          await durumlariOku();
        }}
      />
      <Satir
        no={2}
        baslik="Konum izni"
        aciklama="Uygulama açıkken konumunu okuyabilmesi için gerekli."
        durum={onIzin}
        dugme="İzin ver"
        onPress={konumIste}
      />
      <Satir
        no={3}
        baslik="Arka planda konum"
        aciklama="Ekran kapalıyken de konumun gitsin diye. Telefonun bunu Ayarlar'dan istiyor — “Her zaman izin ver” seçeceksin."
        durum={arkaIzin}
        dugme="Ayarla"
        onPress={arkaPlanIste}
      />
      <Satir
        no={4}
        baslik="Bildirimler"
        aciklama="Yeni iş atandığında haberin olsun."
        durum={bildirim}
        dugme="İzin ver"
        onPress={bildirimIste}
      />

      {/* Pil ve otomatik başlatma DURUMU OKUNAMIYOR (Android izin vermiyor),
          o yüzden rozetsiz — her zaman elle tetiklenebilir dururlar. */}
      <View style={s.kart}>
        <View style={s.basSatir}>
          <Text style={s.no}>5</Text>
          <Text style={s.baslik}>Pil kısıtlaması</Text>
        </View>
        <Text style={s.aciklama}>
          Telefonun uygulamayı uyutmasını engeller. Bu adım olmadan konum
          birkaç dakika sonra kesilir.
        </Text>
        <TouchableOpacity style={s.dugme} onPress={pilIste}>
          <Text style={s.dugmeYazi}>Kısıtlamayı kaldır</Text>
        </TouchableOpacity>
      </View>

      <View style={s.kart}>
        <View style={s.basSatir}>
          <Text style={s.no}>6</Text>
          <Text style={s.baslik}>Otomatik başlatma</Text>
        </View>
        <Text style={s.aciklama}>
          Tecno, Xiaomi, Oppo gibi telefonlarda ayrı bir ayar. Konum sürekli
          kesiliyorsa buraya bak.
        </Text>
        <TouchableOpacity style={s.dugme} onPress={otomatikBaslatma}>
          <Text style={s.dugmeYazi}>Nasıl yapılır?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[s.bitir, !zorunluTamam && s.bitirPasif]}
        onPress={onBitti}
      >
        <Text style={s.bitirYazi}>
          {zorunluTamam ? "Bitti, devam et" : "Şimdilik geç"}
        </Text>
      </TouchableOpacity>
      {!zorunluTamam && (
        <Text style={s.uyari}>
          1, 2 ve 3 tamamlanmadan mesaiye başlayamazsın.
        </Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  kok: { flex: 1, backgroundColor: "#f8fafc" },
  icerik: { padding: 16, gap: 12 },
  ustBaslik: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  ustAciklama: { fontSize: 14, color: "#475569", lineHeight: 20, marginBottom: 4 },
  kart: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 8,
  },
  basSatir: { flexDirection: "row", alignItems: "center", gap: 8 },
  no: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0d9488",
    color: "#fff",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "700",
    fontSize: 13,
  },
  baslik: { flex: 1, fontSize: 16, fontWeight: "700", color: "#0f172a" },
  rozet: { fontSize: 12, fontWeight: "700" },
  rozetOk: { color: "#059669" },
  rozetKotu: { color: "#b91c1c" },
  rozetGri: { color: "#94a3b8" },
  aciklama: { fontSize: 13, color: "#475569", lineHeight: 19 },
  dugme: {
    backgroundColor: "#0d9488",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  dugmeYazi: { color: "#fff", fontWeight: "700", fontSize: 14 },
  bitir: {
    marginTop: 8,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  bitirPasif: { backgroundColor: "#64748b" },
  bitirYazi: { color: "#fff", fontWeight: "700", fontSize: 15 },
  uyari: { fontSize: 12, color: "#b91c1c", textAlign: "center" },
});
