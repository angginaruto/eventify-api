// src/modules/event/event.service.ts
import prisma from "../../lib/prisma.js";
import type {
  CreateEventInput,
  UpdateEventInput,
  EventQuery,
} from "./event.validation.js";

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") +
    "-" +
    Date.now()
  );
}

// ── GET /events ───────────────────────────────────────────────

export async function getEvents(query: EventQuery) {
  const { search, categoryId, location, type, status, startDate, page, limit } =
    query;
  const skip = (page - 1) * limit;

  const where: any = {
    ...(status ? { status } : { status: "PUBLISHED" }),
    ...(categoryId && { categoryId }),
    ...(location && {
      location: { contains: location, mode: "insensitive" },
    }),
    ...(type === "free" && { isFree: true }),
    ...(type === "paid" && { isFree: false }),
    ...(startDate && { startDate: { gte: startDate } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startDate: "asc" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        organizer: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { reviews: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  // hitung rata-rata rating per event
  const eventsWithRating = await Promise.all(
    events.map(async (event) => {
      const avg = await prisma.review.aggregate({
        where: { eventId: event.id },
        _avg: { rating: true },
      });
      return {
        ...event,
        averageRating: avg._avg.rating ?? 0,
        reviewCount: event._count.reviews,
      };
    }),
  );

  return {
    data: eventsWithRating,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── GET /events/:id ───────────────────────────────────────────

export async function getEventById(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      category: true,
      organizer: { select: { id: true, name: true, avatarUrl: true } },
      promotions: {
        where: {
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
        },
      },
      _count: { select: { reviews: true } },
    },
  });

  if (!event) throw new Error("Event not found");

  const avg = await prisma.review.aggregate({
    where: { eventId: id },
    _avg: { rating: true },
  });

  return {
    ...event,
    averageRating: avg._avg.rating ?? 0,
    reviewCount: event._count.reviews,
  };
}

// ── POST /events ──────────────────────────────────────────────

export async function createEvent(
  organizerId: string,
  input: CreateEventInput,
) {
  const { price, ...rest } = input;
  const isFree = price === 0;
  const slug = generateSlug(input.title);

  const event = await prisma.event.create({
    data: {
      ...rest,
      price,
      isFree,
      slug,
      organizerId,
      status: "DRAFT",
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  return event;
}

// ── PUT /events/:id ───────────────────────────────────────────

export async function updateEvent(
  id: string,
  organizerId: string,
  input: UpdateEventInput,
) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new Error("Event not found");
  if (event.organizerId !== organizerId) throw new Error("Forbidden");

  const { price, ...rest } = input;
  const isFree = price !== undefined ? price === 0 : undefined;

  const updated = await prisma.event.update({
    where: { id },
    data: {
      ...rest,
      ...(price !== undefined && { price, isFree }),
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  return updated;
}

// ── DELETE /events/:id ────────────────────────────────────────

export async function deleteEvent(id: string, organizerId: string) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new Error("Event not found");
  if (event.organizerId !== organizerId) throw new Error("Forbidden");

  // jika sudah ada transaksi, tidak bisa dihapus — hanya cancel
  const txCount = await prisma.transaction.count({ where: { eventId: id } });
  if (txCount > 0) {
    return await prisma.event.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  }

  return await prisma.event.delete({ where: { id } });
}

// ── GET /events/organizer (list event milik organizer) ────────

export async function getOrganizerEvents(
  organizerId: string,
  query: EventQuery,
) {
  const { page, limit, status, search } = query;
  const skip = (page - 1) * limit;

  const where: any = {
    organizerId,
    ...(status && { status }),
    ...(search && {
      title: { contains: search, mode: "insensitive" },
    }),
  };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { transactions: true, reviews: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return {
    data: events,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── GET /categories ───────────────────────────────────────────

export async function getCategories() {
  return await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}
