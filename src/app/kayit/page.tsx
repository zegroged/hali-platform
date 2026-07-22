"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";
import PlanCard from "@/components/PlanCard";
import { PLAN } from "@/lib/plan";
import { CITIES, districtsOfCity } from "@/lib/cities";

/** Alan bazlı doğrulama hataları (alan adı → mesaj). */
type Field =
  | "businessName"
  | "name"
  | "phone"
  | "username"
  | "email"
  | "emailCode"
  | "password"
  | "password2"
  | "district"
  | "consent";
type FieldErrors = Partial<Record<Field, string>>;

// Funnel: paket kartı (fiyat + faydalar) → kayıt formu → ödeme yöntemleri.
// 6502 md.61 (dürüst reklam): "ücretsiz" vurgusu, devamındaki abonelik
// bedelini gizlemesin — tutar formun üstündeki paket kartında açıkça yazılır.

export default function KayitPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    name: "",
    phone: "",
    username: "",
    email: "",
    password: "",
    city: "",
    district: "",
    referralCode: "",
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
  // Şifre tekrarı: yanlış yazılan şifreyle boşuna uğraşılmasın (yalnız
  // istemci doğrulaması, API'ye gönderilmez).
  const [password2, setPassword2] = useState("");
  // Honeypot: görünmez alan; botlar doldurur, insanlar görmez.
  const [website, setWebsite] = useState("");
  // Funnel adımı: önce YALNIZ paket kartı; "Hemen Başla" formu açar.
  // (hidden ile gizlenir, unmount edilmez — geri dönüşte yazılanlar kaybolmaz)
  const [started, setStarted] = useState(false);

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
        // Hata e-posta alanının HEMEN ALTINDA gösterilsin (sağdaki uzak özet
        // kutusunda değil) — mobilde kullanıcı "kayıtlı/geçersiz" uyarısını görsün.
        setFieldErrors((f) => ({
          ...f,
          email: data?.error ?? "Kod gönderilemedi, tekrar deneyin.",
        }));
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
      setFieldErrors((f) => ({
        ...f,
        email: "Bağlantı hatası, lütfen tekrar deneyin.",
      }));
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

  // Opsiyonel fotoğraflar: kayıt başarıyla oturum kurduktan sonra
  // /api/panel/upload'a tür tür yüklenir (best-effort — biri düşerse kayıt
  // bozulmaz, panelden tamamlanır).
  const logoRef = useRef<HTMLInputElement>(null);
  const genelRef = useRef<HTMLInputElement>(null);
  const onceRef = useRef<HTMLInputElement>(null);
  const sonraRef = useRef<HTMLInputElement>(null);
  async function uploadPhotosBestEffort() {
    const jobs: [string, HTMLInputElement | null][] = [
      ["logo", logoRef.current],
      ["genel", genelRef.current],
      ["before", onceRef.current],
      ["after", sonraRef.current],
    ];
    for (const [kind, input] of jobs) {
      const files = input?.files;
      if (!files || files.length === 0) continue;
      try {
        const fd = new FormData();
        fd.append("kind", kind);
        for (const f of Array.from(files).slice(0, 10)) fd.append("files", f);
        await fetch("/api/panel/upload", { method: "POST", body: fd });
      } catch {
        // sessiz geç — panelden yüklenebilir
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: FieldErrors = {};
    if (form.businessName.trim().length < 2)
      errs.businessName = "İşletme adı gerekli.";
    if (form.name.trim().length < 2) errs.name = "Ad soyad gerekli.";
    if (!/^0[2-5]\d{9}$/.test(form.phone))
      errs.phone = "Telefon 11 hane olmalı (05xx cep veya 0xxx sabit hat).";
    {
      // Sunucudakiyle aynı kural (src/lib/username.ts) — erken geri bildirim.
      const u = form.username.trim().toLowerCase();
      if (u.length < 3) errs.username = "Kullanıcı adı en az 3 karakter olmalı.";
      else if (!/^[a-z0-9çğıöşü._-]+$/.test(u))
        errs.username =
          "Yalnız harf, rakam ve . _ - kullanılabilir (boşluk ve @ olamaz).";
      else if (/^\d+$/.test(u))
        errs.username = "Kullanıcı adı yalnız rakamlardan oluşamaz.";
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      errs.email = "Geçerli bir e-posta adresi gir.";
    if (form.password.length < 8)
      errs.password = "Şifre en az 8 karakter olmalı.";
    else if (password2 !== form.password)
      errs.password2 = "Şifreler eşleşmiyor.";
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
      // Hesap açıldı ve oturum kuruldu — seçilmiş fotoğraflar varsa yükle
      // (best-effort), sonra panel eksik-tamamlama listesi yönlendirir.
      await uploadPhotosBestEffort();
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
      <main className="mx-auto w-full max-w-sm flex-1 px-6 py-10 md:max-w-4xl">
        <Link href="/" className="mb-6 block text-sm text-brand-dark hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          İşletmeni Ekle
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Müşteriler seni konumuna göre bulsun; siparişlerini ve şoförlerini
          tek panelden yönet.
        </p>

        {/* Funnel 1. adım: yalnız paket kartı; "Hemen Başla" formu açar */}
        <div className={started ? "hidden" : "mt-7"}>
          <PlanCard wide onCta={() => setStarted(true)} ctaLabel="Hemen Başla" />
        </div>

        {/* Funnel 2. adım: SOLDA kayıt + ödeme alanları, SAĞDA sipariş özeti
            (bedel + KDV + toplam) ve "Ödemeyi Tamamla ve Kayıt Ol" butonu */}
        <div className={started ? "" : "hidden"}>
        <button
          type="button"
          onClick={() => setStarted(false)}
          className="mt-4 text-sm font-medium text-brand-dark hover:underline"
        >
          ← Paketi gör
        </button>
        <form
          onSubmit={submit}
          noValidate
          className="mt-3 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-8"
        >
        <div className="space-y-3">
        <h2 className="font-semibold text-slate-900">Kayıt bilgileri</h2>
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
              placeholder="05xx… veya sabit hat 0342…"
              className={inputCls(fieldErrors.phone)}
              autoComplete="tel"
            />
            <p className="mt-1 text-xs text-slate-500">
              Müşterilerin sana ulaşacağı numara — girişte kullanılmaz.
            </p>
            {err("phone")}
          </div>
          <div>
            <label htmlFor="kayit-kullanici-adi" className={labelCls}>
              Kullanıcı adı
            </label>
            <input
              id="kayit-kullanici-adi"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              type="text"
              maxLength={30}
              placeholder="orn: mehmet.hali"
              className={inputCls(fieldErrors.username)}
              autoComplete="username"
            />
            <p className="mt-1 text-xs text-slate-500">
              Girişte bunu veya e-postanı kullanacaksın. Harf, rakam ve . _ -
              (büyük/küçük harf farketmez).
            </p>
            {err("username")}
          </div>
          <div>
            <label htmlFor="kayit-referans" className={labelCls}>
              Komisyoncu / referans kodu{" "}
              <span className="text-xs font-normal text-slate-400">(varsa)</span>
            </label>
            <input
              id="kayit-referans"
              className={inputCls(undefined)}
              placeholder="HYK-1234"
              maxLength={20}
              value={form.referralCode}
              onChange={(e) => set("referralCode", e.target.value)}
            />
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
          <div>
            <label htmlFor="kayit-sifre2" className={labelCls}>
              Şifre (tekrar)
            </label>
            <input
              id="kayit-sifre2"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              maxLength={72}
              className={inputCls(fieldErrors.password2)}
              autoComplete="new-password"
            />
            {err("password2")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="kayit-il" className={labelCls}>
                İl
              </label>
              {/* Serbest metin değil: yazım hatası şehir sayfası/ilçe
                  eşleşmesini bozuyordu — 81 il listesinden seçilir. */}
              <select
                id="kayit-il"
                value={form.city}
                onChange={(e) => {
                  set("city", e.target.value);
                  set("district", "");
                }}
                required
                className={inputCls()}
              >
                <option value="" disabled>
                  İl seç
                </option>
                {CITIES.map((c) => (
                  <option key={c.slug} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="kayit-ilce" className={labelCls}>
                İlçe
              </label>
              <select
                id="kayit-ilce"
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
                required
                disabled={!form.city}
                className={inputCls(fieldErrors.district)}
              >
                <option value="" disabled>
                  {form.city ? "İlçe seç" : "Önce il seç"}
                </option>
                {districtsOfCity(form.city).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {err("district")}
            </div>
          </div>

          {/* Opsiyonel fotoğraflar — kayıt sonrası otomatik yüklenir; atlanırsa
              panelden eklenir (yayın için en az 1 fotoğraf gerekir). */}
          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-medium text-slate-600">
              Fotoğraflar (opsiyonel — sonradan panelden de eklenir)
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="kayit-logo" className={labelCls}>
                  Logo <span className="text-xs text-slate-400">(tek dosya)</span>
                </label>
                <input
                  id="kayit-logo"
                  ref={logoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-brand-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-dark"
                />
              </div>
              <div>
                <label htmlFor="kayit-foto" className={labelCls}>
                  İşletme fotoğrafları
                </label>
                <input
                  id="kayit-foto"
                  ref={genelRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
                />
              </div>
              <div>
                <label htmlFor="kayit-once" className={labelCls}>
                  Öncesi fotoğrafları
                </label>
                <input
                  id="kayit-once"
                  ref={onceRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
                />
              </div>
              <div>
                <label htmlFor="kayit-sonra" className={labelCls}>
                  Sonrası fotoğrafları
                </label>
                <input
                  id="kayit-sonra"
                  ref={sonraRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              jpg/png/webp, adet başı ≤5MB. Öncesi/Sonrası kareleri profilinde
              etiketli galeri olarak görünür — güven kazandırır.
            </p>
          </fieldset>

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

          {/* Ödeme adımı — kart bilgisi iyzico'nun GÜVENLİ sayfasında toplanır
              (PCI: kart numarası bizim sunucumuza hiç girmez). Kayıttan hemen
              sonra panelde "Aboneliğini öde" ile iyzico'ya geçilir; ödeme
              tamamlanınca hesap OTOMATİK yayına alınır. */}
          <section className="!mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Ödeme</h2>
          <div className="mt-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/iyzico-band-colored.svg"
              alt="iyzico ile güvenli ödeme — Visa, Mastercard, Troy"
              className="h-6 w-auto max-w-full"
            />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Kayıt olduktan sonra panelinden <strong>iyzico&apos;nun güvenli
            sayfasında</strong> kartınla ödemeni yaparsın; kart bilgilerin bize
            hiç ulaşmaz. Ödemen tamamlanır tamamlanmaz hesabın{" "}
            <strong>otomatik yayına</strong> girer. Ödeme yapılmadan işletmen
            müşterilere görünmez.
          </p>
        </section>
        </div>

          {/* SAĞ SÜTUN: sipariş özeti — bedel dökümü + onay + ödeme butonu */}
          <aside className="mt-6 h-fit rounded-2xl border border-slate-200 bg-white p-5 md:sticky md:top-6 md:mt-0">
            <h2 className="font-semibold text-slate-900">Sipariş Özeti</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">{PLAN.name} (aylık)</dt>
                <dd className="whitespace-nowrap text-slate-900">
                  {PLAN.priceNetMonthly} TL
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">KDV (%{PLAN.kdvRate})</dt>
                <dd className="whitespace-nowrap text-slate-900">
                  {PLAN.kdvMonthly} TL
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-slate-200 pt-2">
                <dt className="font-semibold text-slate-900">Aylık toplam</dt>
                <dd className="whitespace-nowrap font-semibold text-slate-900">
                  {PLAN.priceGrossMonthly} TL
                </dd>
              </div>
              <div className="flex justify-between gap-2 rounded-lg bg-brand-light px-3 py-2">
                <dt className="font-medium text-brand-dark">
                  Ödenecek (kayıt sonrası)
                </dt>
                <dd className="whitespace-nowrap font-semibold text-brand-dark">
                  {PLAN.priceGrossMonthly} TL
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              Abonelik aylık yenilenir; dilediğinde feshedebilirsin, ileriye
              dönük borç doğmaz. Bedel karşılığında e-arşiv fatura düzenlenir.
            </p>

            {error && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}

            {/* Aracılık sözleşmesi onayı — imza gibi butonun hemen üstünde.
                KVKK satırı ayrı ve onaysız (Aydınlatma Tebliği md.5/1-f). */}
            <div className="mt-4">
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
            <p className="mt-2 text-xs text-slate-500">
              Kişisel verileriniz{" "}
              <Link href="/kvkk" target="_blank" className="underline">
                KVKK Aydınlatma Metni
              </Link>{" "}
              kapsamında işlenir.
            </p>

            <button
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "Hesap açılıyor…" : "Kayıt Ol ve Ödemeye Geç"}
            </button>
          </aside>
        </form>
        </div>

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
