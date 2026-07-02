"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";
import { IconCheck } from "@/components/icons";

/** Alan bazlı doğrulama hataları (alan adı → mesaj). */
type Field =
  | "businessName"
  | "name"
  | "phone"
  | "email"
  | "emailCode"
  | "password"
  | "district"
  | "consent";
type FieldErrors = Partial<Record<Field, string>>;

// Kayıt sonrası panel yol haritası — beklentiyi baştan kur.
// (Sözleşme onayı artık kayıt formundaki checkbox ile alınıyor.)
// 6502 md.61 (dürüst reklam): "ücretsiz" vurgusu, devamındaki abonelik
// bedelini gizlemesin — tutar burada da açıkça yazılır.
const STEPS = [
  "E-postanı doğrula",
  "Profilini tamamla (fiyat, fotoğraf, bölge)",
  "Doğrulamaya gönder",
  "Onaydan sonra ilk 30 gün ücretsiz yayında kal; sonrasında 2.000 TL/ay abonelik",
];

export default function KayitPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    name: "",
    phone: "",
    email: "",
    password: "",
    city: "İstanbul",
    district: "",
  });
  // Aracılık sözleşmesi teyidi — işaretlenmemiş başlar, zorunludur
  // (ETAHS Yönetmeliği: işletme ile elektronik aracılık sözleşmesi kurulması).
  const [consent, setConsent] = useState(false);
  // E-posta doğrulama kodu akışı (kayıt öncesi OTP).
  const [emailCode, setEmailCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Honeypot: görünmez alan; botlar doldurur, insanlar görmez.
  const [website, setWebsite] = useState("");

  async function sendCode() {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setFieldErrors((f) => ({ ...f, email: "Önce geçerli bir e-posta gir." }));
      return;
    }
    setSendingCode(true);
    try {
      const res = await fetch("/api/auth/register/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Kod gönderilemedi, tekrar deneyin.");
        return;
      }
      setCodeSent(true);
      setDevCode(data?.devCode ?? null);
      setFieldErrors((f) => ({ ...f, email: undefined, emailCode: undefined }));
      // 60 sn yeniden gönderme bekleme sayacı
      setCooldown(60);
      const t = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(t);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch {
      setError("Bağlantı hatası, lütfen tekrar deneyin.");
    } finally {
      setSendingCode(false);
    }
  }
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: FieldErrors = {};
    if (form.businessName.trim().length < 2)
      errs.businessName = "İşletme adı gerekli.";
    if (form.name.trim().length < 2) errs.name = "Ad soyad gerekli.";
    if (!/^05\d{9}$/.test(form.phone))
      errs.phone = "Telefon 05xx ile başlamalı ve 11 hane olmalı.";
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      errs.email = "Geçerli bir e-posta adresi gir.";
    if (form.password.length < 8)
      errs.password = "Şifre en az 8 karakter olmalı.";
    if (form.district.trim().length < 2) errs.district = "İlçe gerekli.";
    if (emailCode.trim().length !== 6)
      errs.emailCode = "E-postana gönderilen 6 haneli kodu gir.";
    if (!consent)
      errs.consent =
        "Devam etmek için sözleşmeyi ve kullanım koşullarını kabul etmelisin.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consent, emailCode, website }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Kayıt başarısız, lütfen tekrar deneyin.");
        return;
      }
      // Hesap açıldı ve oturum kuruldu — panel eksik-tamamlama listesi yönlendirir.
      router.push("/panel");
      router.refresh();
    } catch {
      setError("Bağlantı hatası, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = (bad?: string) =>
    `w-full rounded-lg border px-3 py-2 focus:border-brand ${
      bad ? "border-red-500" : "border-slate-300"
    }`;
  const labelCls = "mb-1 block text-sm font-medium text-slate-700";
  const err = (f: Field) =>
    fieldErrors[f] ? (
      <p className="mt-1 text-xs text-red-600">{fieldErrors[f]}</p>
    ) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-sm flex-1 px-6 py-10">
        <Link href="/" className="mb-6 block text-sm text-brand-dark hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          İşletmeni Ücretsiz Kaydet
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Müşteriler seni konumuna göre bulsun; siparişlerini ve şoförlerini
          tek panelden yönet. Onay sonrası ilk 30 gün ücretsiz; sonrasında
          2.000 TL/ay abonelik.
        </p>

        <ul className="mt-4 space-y-1.5">
          {STEPS.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-slate-600"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-dark">
                <IconCheck size={10} />
              </span>
              {s}
            </li>
          ))}
        </ul>

        <form onSubmit={submit} noValidate className="mt-6 space-y-3">
          <div>
            <label htmlFor="kayit-isletme" className={labelCls}>
              İşletme adı
            </label>
            <input
              id="kayit-isletme"
              value={form.businessName}
              onChange={(e) => set("businessName", e.target.value)}
              placeholder="Ör. Kadıköy Halı Yıkama"
              maxLength={80}
              className={inputCls(fieldErrors.businessName)}
              autoComplete="organization"
            />
            {err("businessName")}
          </div>
          <div>
            <label htmlFor="kayit-ad" className={labelCls}>
              Ad Soyad
            </label>
            <input
              id="kayit-ad"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={60}
              className={inputCls(fieldErrors.name)}
              autoComplete="name"
            />
            {err("name")}
          </div>
          <div>
            <label htmlFor="kayit-telefon" className={labelCls}>
              Telefon
            </label>
            <input
              id="kayit-telefon"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
              type="tel"
              inputMode="tel"
              maxLength={11}
              placeholder="05xxxxxxxxx"
              className={inputCls(fieldErrors.phone)}
              autoComplete="tel"
            />
            {err("phone")}
          </div>
          <div>
            <label htmlFor="kayit-eposta" className={labelCls}>
              E-posta
            </label>
            <div className="flex gap-2">
              <input
                id="kayit-eposta"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                type="email"
                inputMode="email"
                maxLength={120}
                placeholder="isletme@ornek.com"
                className={inputCls(fieldErrors.email)}
                autoComplete="email"
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={sendingCode || cooldown > 0}
                className="shrink-0 whitespace-nowrap rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-light/50 disabled:opacity-50"
              >
                {sendingCode
                  ? "Gönderiliyor…"
                  : cooldown > 0
                    ? `Tekrar (${cooldown})`
                    : codeSent
                      ? "Tekrar Gönder"
                      : "Kod Gönder"}
              </button>
            </div>
            {err("email")}
            {codeSent && (
              <div className="mt-2">
                <label htmlFor="kayit-kod" className={labelCls}>
                  E-posta doğrulama kodu
                </label>
                <input
                  id="kayit-kod"
                  value={emailCode}
                  onChange={(e) =>
                    setEmailCode(e.target.value.replace(/\D/g, ""))
                  }
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 haneli kod"
                  className={`${inputCls(fieldErrors.emailCode)} text-center font-mono tracking-[0.3em]`}
                  autoComplete="one-time-code"
                />
                {devCode && (
                  <p className="mt-1 text-sm text-amber-700">
                    Test modu — e-posta altyapısı bağlanana kadar kodun:{" "}
                    <b className="font-mono">{devCode}</b>
                  </p>
                )}
                {err("emailCode")}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="kayit-sifre" className={labelCls}>
              Şifre
            </label>
            <input
              id="kayit-sifre"
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              maxLength={72}
              className={inputCls(fieldErrors.password)}
              autoComplete="new-password"
            />
            {err("password")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="kayit-il" className={labelCls}>
                İl
              </label>
              <input
                id="kayit-il"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                maxLength={40}
                className={inputCls()}
                autoComplete="address-level1"
              />
            </div>
            <div>
              <label htmlFor="kayit-ilce" className={labelCls}>
                İlçe
              </label>
              <input
                id="kayit-ilce"
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
                placeholder="Ör. Kadıköy"
                maxLength={40}
                className={inputCls(fieldErrors.district)}
                autoComplete="address-level2"
              />
              {err("district")}
            </div>
          </div>

          {/* Honeypot — insanlar görmez; dolduran botların kaydı reddedilir */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Aracılık sözleşmesi onayı: işaretlenmemiş zorunlu kutu (aktif teyit).
              KVKK satırı ayrı ve onaysız — aydınlatma "kabul" konusu yapılmaz
              (Aydınlatma Tebliği md.5/1-f: aydınlatma ile rıza ayrıştırılır). */}
          <div>
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
              />
              <span>
                <Link
                  href="/isletme-sozlesmesi"
                  target="_blank"
                  className="font-medium text-brand-dark underline"
                >
                  Platform Aracılık ve Üyelik Sözleşmesi
                </Link>
                &apos;ni ve{" "}
                <Link
                  href="/kosullar"
                  target="_blank"
                  className="font-medium text-brand-dark underline"
                >
                  Kullanım Koşulları
                </Link>
                &apos;nı okudum, kabul ediyorum.
              </span>
            </label>
            {err("consent")}
          </div>
          <p className="text-sm text-slate-500">
            Kişisel verileriniz{" "}
            <Link href="/kvkk" target="_blank" className="underline">
              KVKK Aydınlatma Metni
            </Link>{" "}
            kapsamında işlenir.
          </p>

          <button
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? "Hesap açılıyor…" : "Ücretsiz Kaydol"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500">
          Zaten hesabın var mı?{" "}
          <Link href="/giris" className="text-brand-dark underline">
            Giriş yap
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
