// Web src/lib/phone.ts ile aynı: cep vs sabit hat ayrımı. WhatsApp yalnız cepte.
export function isMobilePhone(raw: string): boolean {
  const d = (raw || "").replace(/\D/g, "");
  return /^05\d{9}$/.test(d);
}

/** Cep numarasıysa wa.me linki, değilse (sabit hat) null → buton gizlenir. */
export function whatsappHref(raw: string, text: string): string | null {
  const d = (raw || "").replace(/\D/g, "");
  if (!isMobilePhone(d)) return null;
  return `https://wa.me/${d.replace(/^0/, "90")}?text=${encodeURIComponent(text)}`;
}
