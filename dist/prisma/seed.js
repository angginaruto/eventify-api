// ============================================================
// prisma/seed.ts
// Jalankan: npx prisma db seed
// ============================================================
import { PrismaClient, Role, EventStatus, PromotionType, } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcrypt";
import { addMonths } from "date-fns";
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
// ── helpers ──────────────────────────────────────────────────
function makeReferralCode(name) {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${name.substring(0, 3).toUpperCase()}${rand}`;
}
function makeCouponCode() {
    return "COUP-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}
// ── main ─────────────────────────────────────────────────────
async function main() {
    console.log("🌱 Seeding database...");
    // ----------------------------------------------------------
    // 1. CATEGORIES
    // ----------------------------------------------------------
    const categories = await Promise.all([
        prisma.category.upsert({
            where: { slug: "music" },
            update: {},
            create: { name: "Music", slug: "music" },
        }),
        prisma.category.upsert({
            where: { slug: "technology" },
            update: {},
            create: { name: "Technology", slug: "technology" },
        }),
        prisma.category.upsert({
            where: { slug: "sports" },
            update: {},
            create: { name: "Sports", slug: "sports" },
        }),
        prisma.category.upsert({
            where: { slug: "arts" },
            update: {},
            create: { name: "Arts & Culture", slug: "arts" },
        }),
        prisma.category.upsert({
            where: { slug: "food" },
            update: {},
            create: { name: "Food & Drink", slug: "food" },
        }),
        prisma.category.upsert({
            where: { slug: "business" },
            update: {},
            create: { name: "Business", slug: "business" },
        }),
    ]);
    console.log(`✅ ${categories.length} categories seeded`);
    // ----------------------------------------------------------
    // 2. USERS — 2 organizers, 5 customers
    // ----------------------------------------------------------
    const passwordHash = await bcrypt.hash("password123", 10);
    const organizer1 = await prisma.user.upsert({
        where: { email: "organizer1@example.com" },
        update: {},
        create: {
            name: "Budi Santoso",
            email: "organizer1@example.com",
            password: passwordHash,
            role: Role.ORGANIZER,
            referralCode: makeReferralCode("Budi"),
        },
    });
    const organizer2 = await prisma.user.upsert({
        where: { email: "organizer2@example.com" },
        update: {},
        create: {
            name: "Sari Dewi",
            email: "organizer2@example.com",
            password: passwordHash,
            role: Role.ORGANIZER,
            referralCode: makeReferralCode("Sari"),
        },
    });
    const customer1 = await prisma.user.upsert({
        where: { email: "customer1@example.com" },
        update: {},
        create: {
            name: "Andi Wijaya",
            email: "customer1@example.com",
            password: passwordHash,
            role: Role.CUSTOMER,
            referralCode: makeReferralCode("Andi"),
        },
    });
    const customer2 = await prisma.user.upsert({
        where: { email: "customer2@example.com" },
        update: {},
        create: {
            name: "Rina Putri",
            email: "customer2@example.com",
            password: passwordHash,
            role: Role.CUSTOMER,
            referralCode: makeReferralCode("Rina"),
        },
    });
    const customer3 = await prisma.user.upsert({
        where: { email: "customer3@example.com" },
        update: {},
        create: {
            name: "Dika Prasetya",
            email: "customer3@example.com",
            password: passwordHash,
            role: Role.CUSTOMER,
            referralCode: makeReferralCode("Dika"),
        },
    });
    const customer4 = await prisma.user.upsert({
        where: { email: "customer4@example.com" },
        update: {},
        create: {
            name: "Maya Sari",
            email: "customer4@example.com",
            password: passwordHash,
            role: Role.CUSTOMER,
            referralCode: makeReferralCode("Maya"),
        },
    });
    const customer5 = await prisma.user.upsert({
        where: { email: "customer5@example.com" },
        update: {},
        create: {
            name: "Farhan Hadi",
            email: "customer5@example.com",
            password: passwordHash,
            role: Role.CUSTOMER,
            referralCode: makeReferralCode("Farh"),
        },
    });
    console.log("✅ 7 users seeded (2 organizers, 5 customers)");
    // Simulasi: customer1 & customer2 daftar pakai referral organizer1
    // → organizer1 dapat 2x 10.000 poin, customer1 & customer2 dapat coupon 10%
    const now = new Date();
    await prisma.point.createMany({
        skipDuplicates: true,
        data: [
            {
                userId: organizer1.id,
                amount: 10000,
                expiresAt: addMonths(now, 3),
            },
            {
                userId: organizer1.id,
                amount: 10000,
                expiresAt: addMonths(now, 3),
            },
        ],
    });
    for (const customer of [customer1, customer2]) {
        await prisma.discountCoupon.upsert({
            where: { code: `REFCOUP-${customer.id.substring(0, 6).toUpperCase()}` },
            update: {},
            create: {
                userId: customer.id,
                code: `REFCOUP-${customer.id.substring(0, 6).toUpperCase()}`,
                discount: 10,
                expiresAt: addMonths(now, 3),
            },
        });
    }
    console.log("✅ Points & referral coupons seeded");
    // ----------------------------------------------------------
    // 3. EVENTS
    // ----------------------------------------------------------
    const [catMusic, catTech, catSports, catArts, catFood, catBusiness] = categories;
    const events = await Promise.all([
        // Paid event — upcoming
        prisma.event.upsert({
            where: { slug: "java-jazz-festival-2025" },
            update: {},
            create: {
                organizerId: organizer1.id,
                categoryId: catMusic.id,
                title: "Java Jazz Festival 2025",
                slug: "java-jazz-festival-2025",
                description: "Festival jazz terbesar di Asia Tenggara. Hadirkan musisi jazz kelas dunia selama 3 hari penuh di Jakarta.",
                location: "Jakarta Convention Center, Jakarta",
                startDate: new Date("2025-06-14T18:00:00Z"),
                endDate: new Date("2025-06-16T23:00:00Z"),
                price: 350000,
                isFree: false,
                availableSeats: 500,
                bookedSeats: 120,
                status: EventStatus.PUBLISHED,
            },
        }),
        // Free event — upcoming
        prisma.event.upsert({
            where: { slug: "bandung-tech-summit-2025" },
            update: {},
            create: {
                organizerId: organizer1.id,
                categoryId: catTech.id,
                title: "Bandung Tech Summit 2025",
                slug: "bandung-tech-summit-2025",
                description: "Konferensi teknologi tahunan dengan topik AI, Web3, dan Cloud Computing. Gratis untuk semua peserta.",
                location: "Trans Luxury Hotel, Bandung",
                startDate: new Date("2025-07-20T08:00:00Z"),
                endDate: new Date("2025-07-20T17:00:00Z"),
                price: 0,
                isFree: true,
                availableSeats: 300,
                bookedSeats: 45,
                status: EventStatus.PUBLISHED,
            },
        }),
        // Paid event — upcoming
        prisma.event.upsert({
            where: { slug: "lari-sehat-bandung-2025" },
            update: {},
            create: {
                organizerId: organizer2.id,
                categoryId: catSports.id,
                title: "Lari Sehat Bandung 2025",
                slug: "lari-sehat-bandung-2025",
                description: "Fun run 5K dan 10K di kawasan Dago Bandung. Terbuka untuk semua kalangan, hadiah menarik menanti.",
                location: "Lapangan Gasibu, Bandung",
                startDate: new Date("2025-08-10T05:30:00Z"),
                endDate: new Date("2025-08-10T10:00:00Z"),
                price: 75000,
                isFree: false,
                availableSeats: 1000,
                bookedSeats: 320,
                status: EventStatus.PUBLISHED,
            },
        }),
        // Paid event — upcoming
        prisma.event.upsert({
            where: { slug: "pameran-seni-modern-jakarta-2025" },
            update: {},
            create: {
                organizerId: organizer2.id,
                categoryId: catArts.id,
                title: "Pameran Seni Modern Jakarta",
                slug: "pameran-seni-modern-jakarta-2025",
                description: "Pameran seni kontemporer menampilkan karya 50 seniman lokal dan internasional di Galeri Nasional.",
                location: "Galeri Nasional Indonesia, Jakarta",
                startDate: new Date("2025-09-01T10:00:00Z"),
                endDate: new Date("2025-09-07T20:00:00Z"),
                price: 50000,
                isFree: false,
                availableSeats: 200,
                bookedSeats: 80,
                status: EventStatus.PUBLISHED,
            },
        }),
        // Free event — upcoming
        prisma.event.upsert({
            where: { slug: "festival-kuliner-nusantara-2025" },
            update: {},
            create: {
                organizerId: organizer1.id,
                categoryId: catFood.id,
                title: "Festival Kuliner Nusantara 2025",
                slug: "festival-kuliner-nusantara-2025",
                description: "Festival kuliner terbesar yang menyajikan ratusan hidangan khas dari 34 provinsi Indonesia.",
                location: "Alun-alun Bandung, Bandung",
                startDate: new Date("2025-10-15T10:00:00Z"),
                endDate: new Date("2025-10-17T22:00:00Z"),
                price: 0,
                isFree: true,
                availableSeats: 2000,
                bookedSeats: 0,
                status: EventStatus.PUBLISHED,
            },
        }),
        // Paid event — completed (untuk seed review & transaksi historis)
        prisma.event.upsert({
            where: { slug: "startup-indonesia-summit-2024" },
            update: {},
            create: {
                organizerId: organizer1.id,
                categoryId: catBusiness.id,
                title: "Startup Indonesia Summit 2024",
                slug: "startup-indonesia-summit-2024",
                description: "Summit ekosistem startup Indonesia terbesar. Networking, pitching, dan workshop dari founder unicorn.",
                location: "Bali Nusa Dua Convention Center, Bali",
                startDate: new Date("2024-11-20T08:00:00Z"),
                endDate: new Date("2024-11-21T18:00:00Z"),
                price: 500000,
                isFree: false,
                availableSeats: 400,
                bookedSeats: 400,
                status: EventStatus.COMPLETED,
            },
        }),
        // Paid event — completed
        prisma.event.upsert({
            where: { slug: "indie-music-night-bandung-2024" },
            update: {},
            create: {
                organizerId: organizer2.id,
                categoryId: catMusic.id,
                title: "Indie Music Night Bandung 2024",
                slug: "indie-music-night-bandung-2024",
                description: "Malam apresiasi musik indie dengan 10 band lokal Bandung terbaik. Satu malam penuh kenangan.",
                location: "Sasana Budaya Ganesha, Bandung",
                startDate: new Date("2024-12-07T19:00:00Z"),
                endDate: new Date("2024-12-07T23:30:00Z"),
                price: 120000,
                isFree: false,
                availableSeats: 300,
                bookedSeats: 280,
                status: EventStatus.COMPLETED,
            },
        }),
    ]);
    console.log(`✅ ${events.length} events seeded`);
    // ----------------------------------------------------------
    // 4. PROMOTIONS
    // ----------------------------------------------------------
    const [evJazz, , evLari, , , evSummit] = events;
    await prisma.promotion.createMany({
        skipDuplicates: true,
        data: [
            // Date-based discount untuk Jazz Festival: diskon 50rb jika beli sebelum April
            {
                eventId: evJazz.id,
                type: PromotionType.DATE_BASED,
                discountValue: 50000,
                quota: null,
                startDate: new Date("2025-01-01"),
                endDate: new Date("2025-04-30"),
            },
            // Referral voucher untuk Lari Sehat: diskon 15rb, quota 50 orang
            {
                eventId: evLari.id,
                type: PromotionType.REFERRAL,
                code: "LARI15K",
                discountValue: 15000,
                quota: 50,
                usedCount: 12,
            },
        ],
    });
    console.log("✅ Promotions seeded");
    // ----------------------------------------------------------
    // 5. TRANSACTIONS — histori untuk completed events
    // ----------------------------------------------------------
    const summitEvent = events[5]; // Startup Indonesia Summit (COMPLETED)
    const indieEvent = events[6]; // Indie Music Night (COMPLETED)
    const txs = await prisma.transaction.createMany({
        skipDuplicates: true,
        data: [
            // customer1 beli summit
            {
                customerId: customer1.id,
                eventId: summitEvent.id,
                quantity: 1,
                basePrice: 500000,
                discountAmount: 0,
                pointsUsed: 0,
                finalPrice: 500000,
                status: "SUCCESS",
                createdAt: new Date("2024-10-15"),
            },
            // customer2 beli summit (pakai coupon 10%)
            {
                customerId: customer2.id,
                eventId: summitEvent.id,
                quantity: 1,
                basePrice: 500000,
                discountAmount: 50000,
                pointsUsed: 0,
                finalPrice: 450000,
                status: "SUCCESS",
                createdAt: new Date("2024-10-18"),
            },
            // customer3 beli summit
            {
                customerId: customer3.id,
                eventId: summitEvent.id,
                quantity: 1,
                basePrice: 500000,
                discountAmount: 0,
                pointsUsed: 0,
                finalPrice: 500000,
                status: "SUCCESS",
                createdAt: new Date("2024-11-01"),
            },
            // customer1 beli indie music
            {
                customerId: customer1.id,
                eventId: indieEvent.id,
                quantity: 2,
                basePrice: 240000,
                discountAmount: 0,
                pointsUsed: 20000,
                finalPrice: 220000,
                status: "SUCCESS",
                createdAt: new Date("2024-11-20"),
            },
            // customer4 beli indie music
            {
                customerId: customer4.id,
                eventId: indieEvent.id,
                quantity: 1,
                basePrice: 120000,
                discountAmount: 0,
                pointsUsed: 0,
                finalPrice: 120000,
                status: "SUCCESS",
                createdAt: new Date("2024-11-22"),
            },
        ],
    });
    console.log(`✅ Transactions seeded`);
    // ----------------------------------------------------------
    // 6. REVIEWS — hanya untuk event COMPLETED
    // ----------------------------------------------------------
    await prisma.review.createMany({
        skipDuplicates: true,
        data: [
            {
                userId: customer1.id,
                eventId: summitEvent.id,
                rating: 5,
                comment: "Event luar biasa! Networking-nya sangat berkualitas dan speaker-nya inspiratif banget.",
            },
            {
                userId: customer2.id,
                eventId: summitEvent.id,
                rating: 4,
                comment: "Konten sangat bagus, tapi venue agak padat. Overall worth it banget!",
            },
            {
                userId: customer3.id,
                eventId: summitEvent.id,
                rating: 5,
                comment: "Salah satu event terbaik yang pernah saya hadiri. Pasti balik lagi tahun depan.",
            },
            {
                userId: customer1.id,
                eventId: indieEvent.id,
                rating: 5,
                comment: "Lineup band-nya top semua. Sound system keren dan atmosfernya malam itu luar biasa!",
            },
            {
                userId: customer4.id,
                eventId: indieEvent.id,
                rating: 4,
                comment: "Seru banget, tapi parkir susah. Musik-nya mantap abis!",
            },
        ],
    });
    console.log("✅ Reviews seeded");
    console.log("\n🎉 Seeding complete!");
    console.log("\n📋 Test accounts (password: password123):");
    console.log("   organizer1@example.com — Budi Santoso (Organizer)");
    console.log("   organizer2@example.com — Sari Dewi (Organizer)");
    console.log("   customer1@example.com  — Andi Wijaya (Customer)");
    console.log("   customer2@example.com  — Rina Putri  (Customer)");
    console.log("   customer3@example.com  — Dika Prasetya (Customer)");
}
main()
    .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
