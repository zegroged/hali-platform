import {
  PrismaClient,
  UserRole,
  VerificationStatus,
  SubscriptionStatus,
  BadgeType,
  PricingUnit,
  OrderStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Demo veri (şifre "1234", admin dahil) ASLA üretime girmemeli.
if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "1") {
  throw new Error(
    "Üretimde seed çalıştırılamaz (demo hesaplar/şifreler). Gerçekten gerekiyorsa ALLOW_PROD_SEED=1.",
  );
}

const WORKING_HOURS = {
  mon: { open: "09:00", close: "19:00" },
  tue: { open: "09:00", close: "19:00" },
  wed: { open: "09:00", close: "19:00" },
  thu: { open: "09:00", close: "19:00" },
  fri: { open: "09:00", close: "19:00" },
  sat: { open: "10:00", close: "17:00" },
  sun: null,
};

type Seed = {
  name: string;
  district: string;
  lat: number;
  lng: number;
  rating: number;
  ratingCount: number;
  minDays: number;
  maxDays: number;
  ownerName: string;
  ownerPhone: string;
  driverName: string;
  driverPhone: string;
  badges: BadgeType[];
};

const SEEDS: Seed[] = [
  {
    name: "Kadıköy Halı Yıkama",
    district: "Kadıköy",
    lat: 40.9907,
    lng: 29.0277,
    rating: 4.8,
    ratingCount: 124,
    minDays: 2,
    maxDays: 3,
    ownerName: "Ahmet Yıldız",
    ownerPhone: "05321112201",
    driverName: "Mehmet Şahin",
    driverPhone: "05331112202",
    badges: [BadgeType.VERIFIED, BadgeType.INSURED],
  },
  {
    name: "Moda Halı Bakım",
    district: "Kadıköy",
    lat: 40.9805,
    lng: 29.0265,
    rating: 4.5,
    ratingCount: 58,
    minDays: 1,
    maxDays: 2,
    ownerName: "Zeynep Demir",
    ownerPhone: "05321112203",
    driverName: "Ali Kaya",
    driverPhone: "05331112204",
    badges: [BadgeType.VERIFIED],
  },
  {
    name: "Üsküdar Temiz Halı",
    district: "Üsküdar",
    lat: 41.0226,
    lng: 29.0167,
    rating: 4.2,
    ratingCount: 31,
    minDays: 2,
    maxDays: 4,
    ownerName: "Hasan Çelik",
    ownerPhone: "05321112205",
    driverName: "Veli Aydın",
    driverPhone: "05331112206",
    badges: [BadgeType.VERIFIED],
  },
];

async function main() {
  const password = await bcrypt.hash("1234", 10);

  await prisma.driverStop.deleteMany();
  await prisma.driverLocationPing.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.review.deleteMany();
  await prisma.order.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.pricingItem.deleteMany();
  await prisma.businessPhoto.deleteMany();
  await prisma.serviceArea.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.cleanerBusiness.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      role: UserRole.ADMIN,
      name: "Platform Admin",
      phone: "05320000000",
      email: "admin@hali.local",
      password,
    },
  });

  // demo müşteri (kayıtlı müşteri akışını test etmek için; sipariş guest de olabilir)
  const customer = await prisma.user.create({
    data: {
      role: UserRole.CUSTOMER,
      name: "Deniz Müşteri",
      phone: "05340001122",
      password,
    },
  });

  const created: { businessId: string; driverId: string; name: string }[] = [];

  for (const s of SEEDS) {
    const owner = await prisma.user.create({
      data: {
        role: UserRole.CLEANER,
        name: s.ownerName,
        phone: s.ownerPhone,
        password,
        phoneVerified: true,
      },
    });

    const business = await prisma.cleanerBusiness.create({
      data: {
        ownerId: owner.id,
        name: s.name,
        description: `${s.district} bölgesinde profesyonel halı yıkama hizmeti.`,
        address: `${s.district}, İstanbul`,
        city: "İstanbul",
        district: s.district,
        lat: s.lat,
        lng: s.lng,
        phone: s.ownerPhone,
        workingHours: WORKING_HOURS,
        deliveryEstimateMinDays: s.minDays,
        deliveryEstimateMaxDays: s.maxDays,
        taxNumber: "1234567890",
        contractAcceptedAt: new Date(),
        verification: VerificationStatus.VERIFIED,
        isVisible: true,
        ratingAvg: s.rating,
        ratingCount: s.ratingCount,
        serviceAreas: { create: [{ city: "İstanbul", district: s.district }] },
        pricing: {
          create: [
            { label: "Makine Halısı", unit: PricingUnit.PER_M2, price: 45 },
            { label: "Yün / El Dokuma", unit: PricingUnit.PER_M2, price: 80 },
            { label: "Saçak Onarımı", unit: PricingUnit.FLAT, price: 150, isAddon: true },
            { label: "Leke / Koku Giderme", unit: PricingUnit.FLAT, price: 100, isAddon: true },
          ],
        },
        badges: { create: s.badges.map((type) => ({ type })) },
        subscription: {
          create: { status: SubscriptionStatus.ACTIVE, priceMonthly: 2000 },
        },
      },
    });

    const driverUser = await prisma.user.create({
      data: {
        role: UserRole.DRIVER,
        name: s.driverName,
        phone: s.driverPhone,
        password,
      },
    });

    const driver = await prisma.driver.create({
      data: { userId: driverUser.id, businessId: business.id, isOnShift: false },
    });

    created.push({ businessId: business.id, driverId: driver.id, name: s.name });
  }

  // demo sipariş — ilk halıcıya, henüz atanmamış (CREATED) — panelden kabul edilebilir
  const first = created[0];
  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      customerName: "Deniz Müşteri",
      customerPhone: "05340001122",
      pickupAddress: "Caferağa Mah. Moda Cad. No:12, Kadıköy",
      pickupLat: 40.9875,
      pickupLng: 29.0258,
      approxM2: 12,
      note: "İki adet yün halı, kapıda nakit.",
      businessId: first.businessId,
      driverId: first.driverId,
      code: "DEMO12",
      status: OrderStatus.CREATED,
      paymentMethod: "CASH",
    },
  });
  await prisma.orderEvent.create({
    data: { orderId: order.id, status: OrderStatus.CREATED, note: "Talep oluşturuldu" },
  });

  // ilk şoförü mesaide + konumlu yap (canlı harita demosu için)
  const nowD = new Date();
  await prisma.driver.update({
    where: { id: created[0].driverId },
    data: { isOnShift: true, lastLat: 40.9905, lastLng: 29.0278, lastSeenAt: nowD },
  });

  // demo durak kayıtları (aylık rapor demosu için)
  const py = nowD.getFullYear();
  const pm = nowD.getMonth() + 1;
  const demoStops = [
    { lat: 40.9875, lng: 29.0258, address: "Caferağa Mah., Kadıköy", minsAgo: 30, durMin: 9 },
    { lat: 40.9901, lng: 29.0289, address: "Rasimpaşa Mah., Kadıköy", minsAgo: 95, durMin: 14 },
    { lat: 40.9805, lng: 29.0265, address: "Moda Cad., Kadıköy", minsAgo: 160, durMin: 6 },
  ];
  for (const st of demoStops) {
    const started = new Date(nowD.getTime() - st.minsAgo * 60000);
    await prisma.driverStop.create({
      data: {
        driverId: created[0].driverId,
        lat: st.lat,
        lng: st.lng,
        address: st.address,
        startedAt: started,
        endedAt: new Date(started.getTime() + st.durMin * 60000),
        durationSec: st.durMin * 60,
        periodYear: py,
        periodMonth: pm,
      },
    });
  }

  // demo konum izi (canlı iz + rota geçmişi demosu) — bugün, 8 dk arayla
  const routePts: [number, number][] = [
    [40.9907, 29.0277],
    [40.9901, 29.0289],
    [40.9895, 29.027],
    [40.9888, 29.0262],
    [40.988, 29.026],
    [40.9875, 29.0258],
    [40.987, 29.0265],
    [40.9866, 29.0275],
    [40.9872, 29.0285],
    [40.9885, 29.029],
    [40.9895, 29.0285],
    [40.9905, 29.0278],
  ];
  for (let i = 0; i < routePts.length; i++) {
    await prisma.driverLocationPing.create({
      data: {
        driverId: created[0].driverId,
        lat: routePts[i][0],
        lng: routePts[i][1],
        recordedAt: new Date(nowD.getTime() - (routePts.length - i) * 8 * 60000),
      },
    });
  }

  // onay bekleyen demo halıcı (doğrulama akışı + admin demosu) — telefon/sözleşme YOK
  const pendingOwner = await prisma.user.create({
    data: {
      role: UserRole.CLEANER,
      name: "Yeni Halıcı",
      phone: "05321119999",
      password,
      phoneVerified: false,
    },
  });
  await prisma.cleanerBusiness.create({
    data: {
      ownerId: pendingOwner.id,
      name: "Yeni Halı Yıkama",
      description: "Beşiktaş bölgesinde yeni açılan halı yıkama.",
      address: "Beşiktaş, İstanbul",
      city: "İstanbul",
      district: "Beşiktaş",
      lat: 41.0422,
      lng: 29.0093,
      phone: "05321119999",
      verification: VerificationStatus.PENDING,
      isVisible: false,
      serviceAreas: { create: [{ city: "İstanbul", district: "Beşiktaş" }] },
      subscription: {
        create: { status: SubscriptionStatus.ACTIVE, priceMonthly: 2000 },
      },
    },
  });

  console.log(
    `✓ Tohumlama tamam: ${created.length} doğrulanmış halıcı + 1 onay bekleyen, ${created.length} şoför, 1 admin, 1 müşteri, 1 demo sipariş, ${demoStops.length} durak, ${routePts.length} konum izi.`,
  );
  console.log("  Giriş: şifre 1234 · Onay bekleyen halıcı: 05321119999");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
