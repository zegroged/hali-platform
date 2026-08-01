"use client";

// Yazdırılabilir belgelerde (gider pusulası) tek işlevli düğme.
// RSC'de onClick olmaz; bu minicik istemci bileşeni o yüzden var.
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark print:hidden"
    >
      Yazdır / PDF kaydet
    </button>
  );
}
