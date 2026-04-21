// src/modules/review/review.service.ts
import prisma from "../../lib/prisma.js";
// ── POST /events/:id/reviews ──────────────────────────────────
export async function createReview(eventId, userId, input) {
    // 1. cek event exist & sudah COMPLETED
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event)
        throw new Error("Event not found");
    if (event.status !== "COMPLETED") {
        throw new Error("You can only review completed events");
    }
    // 2. cek user punya transaksi SUCCESS untuk event ini
    const transaction = await prisma.transaction.findFirst({
        where: {
            eventId,
            customerId: userId,
            status: "SUCCESS",
        },
    });
    if (!transaction) {
        throw new Error("You must have attended this event to leave a review");
    }
    // 3. cek sudah pernah review atau belum
    const existing = await prisma.review.findUnique({
        where: { userId_eventId: { userId, eventId } },
    });
    if (existing)
        throw new Error("You have already reviewed this event");
    // 4. buat review
    const review = await prisma.review.create({
        data: {
            userId,
            eventId,
            rating: input.rating,
            comment: input.comment,
        },
        include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
        },
    });
    return review;
}
// ── GET /events/:id/reviews ───────────────────────────────────
export async function getEventReviews(eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event)
        throw new Error("Event not found");
    const [reviews, aggregate] = await Promise.all([
        prisma.review.findMany({
            where: { eventId },
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
            },
        }),
        prisma.review.aggregate({
            where: { eventId },
            _avg: { rating: true },
            _count: { rating: true },
        }),
    ]);
    return {
        reviews,
        meta: {
            averageRating: aggregate._avg.rating
                ? Math.round(aggregate._avg.rating * 10) / 10
                : 0,
            totalReviews: aggregate._count.rating,
        },
    };
}
