// src/modules/dashboard/dashboard.service.ts
import prisma from "../../lib/prisma.js";
// ── helper: format grouping key ──────────────────────────────
function getDateFormat(range, date) {
    if (range === "day") {
        return date.toISOString().split("T")[0]; // YYYY-MM-DD
    }
    else if (range === "month") {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
    }
    else {
        return `${date.getFullYear()}`; // YYYY
    }
}
// ── GET /dashboard/stats ──────────────────────────────────────
export async function getDashboardStats(organizerId, range) {
    // 1. ambil semua event milik organizer
    const events = await prisma.event.findMany({
        where: { organizerId },
        select: { id: true, title: true, status: true },
    });
    const eventIds = events.map((e) => e.id);
    if (eventIds.length === 0) {
        return {
            summary: {
                totalRevenue: 0,
                totalAttendees: 0,
                totalEvents: 0,
                publishedEvents: 0,
                completedEvents: 0,
            },
            chartData: [],
            topEvents: [],
        };
    }
    // 2. ambil semua transaksi SUCCESS untuk event-event ini
    const transactions = await prisma.transaction.findMany({
        where: {
            eventId: { in: eventIds },
            status: "SUCCESS",
        },
        select: {
            finalPrice: true,
            quantity: true,
            createdAt: true,
            eventId: true,
            event: { select: { title: true } },
        },
        orderBy: { createdAt: "asc" },
    });
    // 3. hitung summary
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.finalPrice, 0);
    const totalAttendees = transactions.reduce((sum, tx) => sum + tx.quantity, 0);
    const publishedEvents = events.filter((e) => e.status === "PUBLISHED").length;
    const completedEvents = events.filter((e) => e.status === "COMPLETED").length;
    // 4. group transaksi per periode untuk chart
    const grouped = {};
    for (const tx of transactions) {
        const key = getDateFormat(range, tx.createdAt);
        if (!grouped[key]) {
            grouped[key] = { revenue: 0, attendees: 0 };
        }
        grouped[key].revenue += tx.finalPrice;
        grouped[key].attendees += tx.quantity;
    }
    const chartData = Object.entries(grouped)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
    // 5. top 5 events by revenue
    const eventRevenueMap = {};
    for (const tx of transactions) {
        if (!eventRevenueMap[tx.eventId]) {
            eventRevenueMap[tx.eventId] = {
                title: tx.event.title,
                revenue: 0,
                attendees: 0,
            };
        }
        eventRevenueMap[tx.eventId].revenue += tx.finalPrice;
        eventRevenueMap[tx.eventId].attendees += tx.quantity;
    }
    const topEvents = Object.entries(eventRevenueMap)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    return {
        summary: {
            totalRevenue,
            totalAttendees,
            totalEvents: events.length,
            publishedEvents,
            completedEvents,
        },
        chartData,
        topEvents,
    };
}
// ── GET /dashboard/events — list event organizer dengan stats ─
export async function getOrganizerEventStats(organizerId) {
    const events = await prisma.event.findMany({
        where: { organizerId },
        orderBy: { createdAt: "desc" },
        include: {
            category: { select: { name: true } },
            _count: { select: { transactions: true, reviews: true } },
        },
    });
    // hitung revenue per event
    const eventsWithStats = await Promise.all(events.map(async (event) => {
        const revenue = await prisma.transaction.aggregate({
            where: { eventId: event.id, status: "SUCCESS" },
            _sum: { finalPrice: true, quantity: true },
        });
        const avgRating = await prisma.review.aggregate({
            where: { eventId: event.id },
            _avg: { rating: true },
        });
        return {
            id: event.id,
            title: event.title,
            status: event.status,
            startDate: event.startDate,
            location: event.location,
            price: event.price,
            isFree: event.isFree,
            availableSeats: event.availableSeats,
            bookedSeats: event.bookedSeats,
            category: event.category.name,
            totalRevenue: revenue._sum.finalPrice ?? 0,
            totalAttendees: revenue._sum.quantity ?? 0,
            totalTransactions: event._count.transactions,
            totalReviews: event._count.reviews,
            averageRating: avgRating._avg.rating
                ? Math.round(avgRating._avg.rating * 10) / 10
                : 0,
        };
    }));
    return eventsWithStats;
}
