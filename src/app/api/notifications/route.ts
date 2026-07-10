import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth";

// Oturumdaki kullanıcının bildirimleri: okunmamış sayısı + son 20 kayıt.
// Zil bileşeni bunu ~20 sn'de bir poll eder.
export async function GET() {
  const u = await getAuthedUser();
  if (!u) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const [unread, items] = await Promise.all([
    prisma.notification.count({ where: { userId: u.id, readAt: null } }),
    prisma.notification.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ unread, items });
}
