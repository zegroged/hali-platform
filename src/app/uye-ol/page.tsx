"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";

type Field =
  | "name"
  | "email"
  | "phone"
  | "password"
  | "emailCode"
  | "phoneCode";
type FieldErrors = Partial<Record<Field, string>>;

function UyeOlInner() {
  const router = useRouter();
  const search = useSearchParams();
  // Dönüş adresi (ör. yorum için takip sayfasından geldiyse oraya döner).
  // OPEN REDIRECT koruması (denetim bulgusu): yalnız startsWith("/") yetmez —
  // "//evil.com" ve "/\\evil.com" (tarayıcı \ → /) de "/" ile başlar ve
  // protokol-göreli dış origin'e çözülür → phishing. Yalnız TEK "/" ile başlayan
  // (ikinci karakteri / veya \ OLMAYAN) göreli iç yolu kabul et.
  const donus = search.get("donus") || "/hesabim";
  const safeDonus = /^\/(?![/\\])/.test(donus) ? donus : "/hesabim";

  const [mode, setMode] = useState<"kayit" | "giris">("kayit");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [emailCode, setEmailCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // TELEFON DOĞRULAMA — adım yalnız sunucu "gerekli" derse açılır.
  // NEDEN başlangıç FALSE: WhatsApp teslimatı kapalıyken (bugünkü durum) bu adım
  // görünürse hiç kimse kayıt olamaz. Bu yüzden hata tarafı da "gösterme" yönüne
  // düşmeli: istek başarısız olursa değer FALSE kalır ve form eskisi gibi çalışır.
  const [phoneOtpRequired, setPhoneOtpRequired] = useState(false);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Bayrak sunucuda tutuluyor (build'e gömülmüyor) — bu yüzden uçtan okunur.
    let iptal = false;
    fetch("/api/auth/phone-otp", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // Yalnız NET "true" adımı açsın; beklenmedik gövde geldiğinde kayıt
        // akışını kilitlememek için varsayılan kapalı kalır.
        if (!iptal && d?.required === true) setPhoneOtpRequired(true);
      })
      .catch(() => {});
    return () => {
      iptal = true;
    };
  }, []);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function sendCode() {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setFieldErrors((f) => ({ ...f, email: "Önce geçerli bir e-posta gir." }));
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/auth/register/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFieldErrors((f) => ({
          ...f,
          email: data?.error ?? "Kod gönderilemedi.",
        }));
        return;
      }
      setCodeSent(true);
      setDevCode(data?.devCode ?? null);
    } catch {
      setFieldErrors((f) => ({ ...f, email: "Bağlantı hatası." }));
    } finally {
      setSending(false);
    }
  }

  async function sendPhoneCode() {
    setError(null);
    if (!/^05\d{9}$/.test(form.phone)) {
      setFieldErrors((f) => ({ ...f, phone: "Önce geçerli bir telefon gir." }));
      return;
    }
    setPhoneSending(true);
    try {
      const res = await fetch("/api/auth/phone-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // Sunucu metni AYNEN gösterilir: 503 "doğrulama kapalı", 400 "cep değil",
        // 429 "çok deneme" birbirinden farklı ve kullanıcıya ne yapacağını söylüyor.
        setFieldErrors((f) => ({
          ...f,
          phone: data?.error ?? "Kod gönderilemedi.",
        }));
        return;
      }
      setPhoneCodeSent(true);
      setFieldErrors((f) => ({ ...f, phone: undefined, phoneCode: undefined }));
      // 60 sn bekleme: her istek Meta'da ÜCRETLİ bir mesaj ve sunucudaki
      // 5/saat/IP hakkını yakıyor — arka arkaya basılırsa kullanıcı kendi
      // kendini bir saat kilitliyordu (2026-07-29 denetim).
      setPhoneCooldown(60);
      const t = setInterval(() => {
        setPhoneCooldown((c) => {
          if (c <= 1) {
            clearInterval(t);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch {
      setFieldErrors((f) => ({ ...f, phone: "Bağlantı hatası." }));
    } finally {
      setPhoneSending(false);
    }
  }

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: FieldErrors = {};
    if (form.name.trim().length < 2) errs.name = "Ad soyad gerekli.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Geçerli e-posta gir.";
    if (!/^05\d{9}$/.test(form.phone))
      errs.phone = "Telefon 05xx ile 11 hane olmalı.";
    if (form.password.length < 8) errs.password = "Şifre en az 8 karakter olmalı.";
    if (emailCode.trim().length !== 6)
      errs.emailCode = "E-postana gelen 6 haneli kodu gir.";
    // Kod zorunluluğu adım açıkken var; kapalıyken alan hiç görünmediği için
    // istemci de sormamalı (yoksa kayıt tamamlanamaz).
    if (phoneOtpRequired && phoneCode.trim().length !== 6)
      errs.phoneCode = phoneCodeSent
        ? "Telefonuna gelen 6 haneli kodu gir."
        : "Önce “Kod Gönder” düğmesine bas, gelen kodu gir.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // phoneCode YALNIZ adım açıkken eklenir; kapalıyken gövde eskisiyle
        // birebir aynı kalsın diye anahtar hiç konmaz.
        body: JSON.stringify({
          ...form,
          emailCode,
          ...(phoneOtpRequired ? { phoneCode } : {}),
          website,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Kayıt başarısız.");
        return;
      }
      router.push(safeDonus);
      router.refresh();
    } catch {
      setError("Bağlantı hatası, tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.email || !form.password) {
      setError("E-posta ve şifre gerekli.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.email, password: form.password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "E-posta veya şifre hatalı.");
        return;
      }
      router.push(safeDonus);
      router.refresh();
    } catch {
      setError("Bağlantı hatası, tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  const inp = (bad?: string) =>
    `w-full rounded-lg border px-3 py-2 focus:border-brand ${
      bad ? "border-red-500" : "border-slate-300"
    }`;
  const lbl = "mb-1 block text-sm font-medium text-slate-700";
  const errP = (f: Field) =>
    fieldErrors[f] ? (
      <p className="mt-1 text-xs text-red-600">{fieldErrors[f]}</p>
    ) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
        <Link href="/" className="mb-6 text-sm text-brand-dark hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {mode === "kayit" ? "Üye Ol" : "Üye Girişi"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "kayit"
            ? "Üye ol, deneyimini değerlendir ve puan biriktir."
            : "E-postan ve şifrenle giriş yap."}
        </p>

        {mode === "kayit" ? (
          <form onSubmit={submitSignup} noValidate className="mt-6 space-y-3">
            {/* honeypot */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
            />
            <div>
              <label htmlFor="uye-ad" className={lbl}>
                Ad soyad
              </label>
              <input
                id="uye-ad"
                className={inp(fieldErrors.name)}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                autoComplete="name"
              />
              {errP("name")}
            </div>
            <div>
              <label htmlFor="uye-eposta" className={lbl}>
                E-posta
              </label>
              <div className="flex gap-2">
                <input
                  id="uye-eposta"
                  type="email"
                  className={inp(fieldErrors.email)}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  autoComplete="email"
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={sending || !form.email}
                  className="whitespace-nowrap rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand-dark disabled:opacity-60"
                >
                  {sending ? "..." : codeSent ? "Tekrar" : "Kod Gönder"}
                </button>
              </div>
              {errP("email")}
              {codeSent && (
                <p className="mt-1 text-xs text-emerald-700">
                  Doğrulama kodu e-postana gönderildi.
                  {devCode && (
                    <span className="ml-1 font-mono text-slate-500">
                      (dev: {devCode})
                    </span>
                  )}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="uye-kod" className={lbl}>
                E-posta doğrulama kodu
              </label>
              <input
                id="uye-kod"
                inputMode="numeric"
                maxLength={6}
                className={inp(fieldErrors.emailCode)}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6 haneli kod"
              />
              {errP("emailCode")}
            </div>
            <div>
              <label htmlFor="uye-telefon" className={lbl}>
                Telefon
              </label>
              <input
                id="uye-telefon"
                type="tel"
                inputMode="tel"
                maxLength={11}
                placeholder="05xxxxxxxxx"
                className={inp(fieldErrors.phone)}
                value={form.phone}
                onChange={(e) => {
                  set("phone", e.target.value.replace(/\D/g, ""));
                  // NUMARA DEĞİŞTİ → gönderilmiş kod ARTIK GEÇERSİZ (2026-07-29
                  // denetim): eskiden yeşil "kod gönderildi" yazısı ve eski
                  // numaranın kodu ekranda kalıyordu; kullanıcı numarayı
                  // düzeltip aynı kodu giriyor, sunucu "kod hatalı" diyordu.
                  setPhoneCodeSent(false);
                  setPhoneCode("");
                }}
                autoComplete="tel"
              />
              {errP("phone")}
            </div>
            {/* Telefon doğrulama adımı: bayrak kapalıyken (WhatsApp teslimatı
                yokken) HİÇ render edilmez — form o zaman eskisi gibi tek adımda
                tamamlanır. Kod gönderilene kadar giriş kutusu da açılmaz ki
                kullanıcı eline geçmemiş bir kodu aramasın. */}
            {phoneOtpRequired && (
              <div>
                <button
                  type="button"
                  onClick={sendPhoneCode}
                  disabled={phoneSending || !form.phone || phoneCooldown > 0}
                  className="whitespace-nowrap rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand-dark disabled:opacity-60"
                >
                  {phoneSending
                    ? "..."
                    : phoneCooldown > 0
                      ? `Tekrar (${phoneCooldown})`
                      : phoneCodeSent
                        ? "Tekrar"
                        : "Kod Gönder"}
                </button>
                {phoneCodeSent && (
                  <>
                    <p className="mt-1 text-xs text-emerald-700">
                      Doğrulama kodu WhatsApp ile telefonuna gönderildi.
                    </p>
                    <label
                      htmlFor="uye-telefon-kod"
                      className={`mt-2 ${lbl}`}
                    >
                      Telefon doğrulama kodu
                    </label>
                    <input
                      id="uye-telefon-kod"
                      inputMode="numeric"
                      maxLength={6}
                      className={inp(fieldErrors.phoneCode)}
                      value={phoneCode}
                      onChange={(e) =>
                        setPhoneCode(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="6 haneli kod"
                    />
                  </>
                )}
                {errP("phoneCode")}
              </div>
            )}
            <div>
              <label htmlFor="uye-sifre" className={lbl}>
                Şifre
              </label>
              <input
                id="uye-sifre"
                type="password"
                className={inp(fieldErrors.password)}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                autoComplete="new-password"
              />
              {errP("password")}
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              disabled={loading}
              className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              {loading ? "Kaydediliyor…" : "Üye Ol"}
            </button>
            <p className="text-center text-xs text-slate-400">
              Üye olarak{" "}
              <Link href="/kosullar" className="underline">
                Kullanım Koşulları
              </Link>{" "}
              ve{" "}
              <Link href="/kvkk" className="underline">
                KVKK Aydınlatma Metni
              </Link>
              &apos;ni kabul etmiş olursun.
            </p>
          </form>
        ) : (
          <form onSubmit={submitLogin} noValidate className="mt-6 space-y-3">
            <div>
              <label htmlFor="giris-eposta" className={lbl}>
                E-posta
              </label>
              <input
                id="giris-eposta"
                type="email"
                className={inp()}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="giris-sifre2" className={lbl}>
                Şifre
              </label>
              <input
                id="giris-sifre2"
                type="password"
                className={inp()}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              disabled={loading}
              className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-500">
          {mode === "kayit" ? "Zaten üye misin? " : "Hesabın yok mu? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "kayit" ? "giris" : "kayit");
              setError(null);
              setFieldErrors({});
            }}
            className="font-medium text-brand-dark underline"
          >
            {mode === "kayit" ? "Giriş yap" : "Üye ol"}
          </button>
        </p>
      </main>
      <Footer />
    </div>
  );
}

export default function UyeOlPage() {
  return (
    <Suspense fallback={null}>
      <UyeOlInner />
    </Suspense>
  );
}
