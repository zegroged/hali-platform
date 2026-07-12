import { IconMapPin, IconTruck, IconPackage } from "@/components/icons";

/** 3 adımlı "Nasıl çalışır?" şeridi — ana sayfa ve şehir sayfalarında ortak. */
export default function HowItWorks() {
  const steps = [
    {
      icon: <IconMapPin size={20} />,
      title: "Halıcını seç",
      desc: "Konumunu kullan ya da semtini yaz, yakınındaki halıcıları karşılaştır.",
    },
    {
      icon: <IconTruck size={20} />,
      title: "Halın kapından alınsın",
      desc: "Halıcı halını adresinden teslim alır — ön ödeme yok, ödeme teslimde.",
    },
    {
      icon: <IconPackage size={20} />,
      title: "Adım adım takip et",
      desc: "Yıkamadan teslimata kadar her adımı takip kodunla canlı izle.",
    },
  ];
  return (
    <section id="nasil-calisir" className="mt-8 scroll-mt-4">
      <h2 className="font-semibold text-slate-900">Nasıl çalışır?</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className="absolute right-3.5 top-3.5 text-xs font-semibold text-slate-500">
              {i + 1}. adım
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand-dark">
              {s.icon}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              {s.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
