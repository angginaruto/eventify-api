// src/modules/event/event.service.ts
import prisma from "../../lib/prisma.js";
import type {
  CreateEventInput,
  UpdateEventInput,
  EventQuery,
} from "./event.validation.js";

function generateSlug(title: string): string {
  // slug dibuat dari title yang di-lowercase, spasi diganti dengan dash, dan ditambah timestamp untuk memastikan unik
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
  const skip = (page - 1) * limit; // untuk pagination, skip dihitung dari page dan limit

  const where: any = {
    ...(status ? { status } : { status: { in: ["PUBLISHED", "COMPLETED"] } }), // { status: "PUBLISHED" }), // default hanya tampilkan yang PUBLISHED kalau tidak ada filter status
    ...(categoryId && { categoryId }), // filter by category
    ...(location && {
      location: { contains: location, mode: "insensitive" },
    }),
    ...(type === "free" && { isFree: true }), // filter by free/paid
    ...(type === "paid" && { isFree: false }),
    ...(startDate && { startDate: { gte: startDate } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } }, // search by title
        { description: { contains: search, mode: "insensitive" } }, // search by description
        { location: { contains: search, mode: "insensitive" } }, // search by location
      ],
    }),
  };

  const [events, total] = await Promise.all([
    // promise all untuk eksekusi query findMany dan count secara bersamaan agar lebih efisien
    prisma.event.findMany({
      where, // filter
      skip, // offset
      take: limit,
      orderBy: { startDate: "asc" }, // urutkan dari tanggal terdekat
      include: {
        category: { select: { id: true, name: true, slug: true } }, // include data category tapi hanya id, name, slug
        organizer: { select: { id: true, name: true, avatarUrl: true } }, // include data organizer tapi hanya id, name, avatarUrl
        _count: { select: { reviews: true } }, // include count reviews untuk hitung rata-rata rating nanti, tapi tidak perlu count transactions karena tidak ditampilkan di list
      },
    }),
    prisma.event.count({ where }), // hitung total data untuk pagination, gunakan filter yang sama dengan findMany agar total sesuai dengan jumlah data yang ditampilkan berdasarkan filter
  ]);

  // hitung rata-rata rating per event
  const eventsWithRating = await Promise.all(
    events.map(async (event) => {
      // loop semua event
      const avg = await prisma.review.aggregate({
        where: { eventId: event.id },
        _avg: { rating: true }, // hitung rata-rata rating
      });
      return {
        ...event, // semua data event
        averageRating: avg._avg.rating ?? 0, // rata-rata rating, kalau tidak ada rating (null) jadi 0
        reviewCount: event._count.reviews, // jumlah review, diambil dari count yang sudah include di query findMany, jadi tidak perlu query lagi
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
  // id diambil dari req.params.id yang sudah pasti string
  const event = await prisma.event.findUnique({
    // cari event berdasarkan id
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
    // hitung rata-rata rating untuk event ini
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
  const { price, ...rest } = input; // price diambil terpisah untuk hitung isFree, sisanya disebar ke data event
  const isFree = price === 0; // event dianggap free jika prixe 0
  const slug = generateSlug(input.title); // buat slug dari title, pastikan unik dengan menambahkan timestamp di akhir

  const event = await prisma.event.create({
    // buat event baru di database
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
  // update event berdasarkan id, pastikan event milik organizer yang sedang login
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new Error("Event not found");
  if (event.organizerId !== organizerId) throw new Error("Forbidden");

  const { price, ...rest } = input;
  const isFree = price !== undefined ? price === 0 : undefined;

  const updated = await prisma.event.update({
    // update event di database
    where: { id },
    data: {
      ...rest, // update semua field yang diinput
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

export async function getOrganizerEvents( // ambil list event milik organizer
  organizerId: string,
  query: EventQuery,
) {
  const { page, limit, status, search } = query; // untuk pagination, filter by status, dan search by title
  const skip = (page - 1) * limit;

  const where: any = {
    organizerId, // pastikan hanya ambil event milik organizer yang sedang login
    ...(status && { status }), // filter by status jika diberikan
    ...(search && {
      title: { contains: search, mode: "insensitive" },
    }),
  };

  const [events, total] = await Promise.all([
    // promise all untuk eksekusi query findMany dan count secara bersamaan agar lebih efisien
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
    // ambil semua category untuk dropdown di form create/update event
    orderBy: { name: "asc" },
  });
}
