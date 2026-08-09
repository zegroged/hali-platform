import { merdivenAktif } from "@/lib/plan";
// Yasal metin sürümü — metinlerde esaslı değişiklik yapıldığında GÜNCELLE.
// Sipariş onayında (Order.contractVersion) saklanır: hangi tarihte hangi
// metnin teyit edildiğinin ispatı (Mesafeli Sözleşmeler Yönetmeliği md.7).
// 2026-07-07.1: ücretsiz deneme kaldırıldı; işletme aboneliği "2.000 TL + KDV,
// peşin, ödeme olmadan yayın yok" oldu (işletme sözleşmesi §3).
// 2026-07-08.1: yönetici onayı yayın şartı olmaktan çıktı — profil tam +
// ödeme = OTOMATİK yayın; onay yalnız "Doğrulanmış" rozeti verir (§4).
// 2026-07-15.1: HASAR/KAYIP/AYIPLI HİZMET sorumluluk bölümleri eklendi
// (kosullar §5 revize + §5/A ayıplı hizmet seçimlik haklar + §5/B çözüm süreci
// + §5/C Fotoğraflı Güvence; isletme-sozlesmesi §5 halının korunması + indemnity
// + opsiyonel teminat; mesafeli-satis §6 ve iade §4 genişletildi). Atıflar
// birincil kaynakla teyit edildi; "Sigortalı" rozeti "Fotoğraflı Güvence" oldu.
// DEPLOY AVUKAT ONAYINA BAĞLI; mevcut işletmelere §9 uyarınca 30 gün önceden
// bildirim + panelden yeniden onay alınmalı (işletme aleyhine yeni yükümlülük).
// FİYAT MERDİVENİ sözleşme §3 ve §4'ü değiştiriyor (paket bazlı bedel + Vitrin
// katmanında bedelsiz yayın). Metin ile sürüm BİRLİKTE değişmeli: sürüm
// artmazsa panel "sözleşme güncel" der ve işletme değişmiş metni hiç görmez.
// Bayrak kapalıyken eski sürüm korunur → gereksiz yeniden onay istenmez.
export const CONTRACT_VERSION = merdivenAktif ? "2026-08-10.1" : "2026-07-15.1";
