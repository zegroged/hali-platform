/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";
import Iyzipay from "iyzipay";
import { getIyzicoBaseUrl, paymentsLive } from "@/lib/config";

const API_KEY = process.env.IYZICO_API_KEY ?? "";
const SECRET = process.env.IYZICO_SECRET ?? "";

// PAYMENTS_MODE=live iken anahtarlar ZORUNLU — eksikse sessizce mock'a düşmek
// yerine net hata ver (aksi halde para alınmadan "ödendi" olur).
if (paymentsLive && API_KEY.length === 0) {
  throw new Error("PAYMENTS_MODE=live ama IYZICO_API_KEY boş. Anahtarları gir.");
}

// Gerçek istemci yalnızca canlı mod + anahtar varsa kurulur; yoksa mock.
export const iyzicoEnabled = paymentsLive && API_KEY.length > 0;

const client = iyzicoEnabled
  ? new Iyzipay({ apiKey: API_KEY, secretKey: SECRET, uri: getIyzicoBaseUrl() })
  : null;

export type InitParams = {
  orderId: string;
  price: number; // TL
  customerName: string;
  customerPhone: string;
  address: string;
  callbackUrl: string;
};
export type InitResult = {
  ok: boolean;
  paymentPageUrl?: string;
  token?: string;
  error?: string;
  mock?: boolean;
};

// iyzico Checkout Form başlat → müşterinin kart gireceği güvenli sayfanın URL'i.
export async function initCheckout(p: InitParams): Promise<InitResult> {
  if (!client) {
    // mock: gerçek ödeme yapılandırılmadı → başarılıymış gibi davran
    return {
      ok: true,
      mock: true,
      token: "MOCK-" + p.orderId,
      paymentPageUrl: `${p.callbackUrl}?mock=1&token=MOCK-${p.orderId}`,
    };
  }
  const [first, ...rest] = p.customerName.trim().split(" ");
  const surname = rest.join(" ") || first;
  const price = p.price.toFixed(2);
  const gsm =
    "+90" + p.customerPhone.replace(/\D/g, "").replace(/^90/, "").replace(/^0/, "");
  const request = {
    locale: "tr",
    conversationId: p.orderId,
    price,
    paidPrice: price,
    currency: "TRY",
    basketId: p.orderId,
    paymentGroup: "PRODUCT",
    callbackUrl: p.callbackUrl,
    enabledInstallments: [1],
    buyer: {
      id: p.orderId,
      name: first,
      surname,
      gsmNumber: gsm,
      // UYARI: Sabit sahte e-posta/kimlik no yalnız SANDBOX testi içindir. CANLI'da
      // iyzico geçerli veri bekler (red/askı riski) — siparişte gerçek e-posta
      // (ve gerekiyorsa TC) toplayıp buraya geçir. Canlıya almadan önce düzelt.
      email: "musteri@hali.local",
      identityNumber: "11111111111",
      registrationAddress: p.address,
      city: "Istanbul",
      country: "Turkey",
    },
    shippingAddress: {
      contactName: p.customerName,
      city: "Istanbul",
      country: "Turkey",
      address: p.address,
    },
    billingAddress: {
      contactName: p.customerName,
      city: "Istanbul",
      country: "Turkey",
      address: p.address,
    },
    basketItems: [
      {
        id: p.orderId,
        name: "Halı yıkama hizmeti",
        category1: "Hizmet",
        itemType: "VIRTUAL",
        price,
      },
    ],
  };
  return new Promise((resolve) => {
    client.checkoutFormInitialize.create(request, (err: any, result: any) => {
      if (err || result?.status !== "success") {
        resolve({ ok: false, error: result?.errorMessage ?? String(err) });
      } else {
        resolve({
          ok: true,
          token: result.token,
          paymentPageUrl: result.paymentPageUrl,
        });
      }
    });
  });
}

export type RetrieveResult = {
  ok: boolean;
  paid: boolean;
  orderId?: string; // basketId — iyzico'nun döndürdüğü değer (client'a güvenilmez)
  paidPrice?: number; // gerçekten tahsil edilen tutar (tutar doğrulaması için)
};

// iyzico retrieve yanıtının imzasını doğrula (defense-in-depth). retrieve zaten
// kimlik-doğrulamalı sunucu-sunucu çağrı olduğundan asıl güven sınırı odur; imza
// ek bir tamper kanıtıdır. ALAN SIRASI iyzico dökümanına göredir — canlıya
// çıkmadan SANDBOX'ta bir gerçek ödemeyle teyit edilmeli.
function signatureValid(result: any): boolean {
  if (!result?.signature) return true; // imza yoksa atla (retrieve güveni yeterli)
  try {
    const payload = [
      result.paymentStatus,
      result.paymentId,
      result.currency,
      result.basketId,
      result.conversationId,
      result.paidPrice,
      result.price,
      result.token,
    ].join(":");
    const calc = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    return calc === result.signature;
  } catch {
    return false;
  }
}

// Ödeme dönüşünde sonucu doğrula (yalnız bu kimlik-doğrulamalı yanıta güven).
export async function retrieveCheckout(token: string): Promise<RetrieveResult> {
  if (!client) return { ok: true, paid: true }; // mock (yalnız dev; callback canlı-modda çalışır)
  return new Promise((resolve) => {
    client.checkoutForm.retrieve({ locale: "tr", token }, (err: any, result: any) => {
      if (err || result?.status !== "success" || !signatureValid(result)) {
        resolve({ ok: false, paid: false });
      } else {
        resolve({
          ok: true,
          paid: result.paymentStatus === "SUCCESS",
          orderId: result.basketId,
          paidPrice: result.paidPrice != null ? Number(result.paidPrice) : undefined,
        });
      }
    });
  });
}
