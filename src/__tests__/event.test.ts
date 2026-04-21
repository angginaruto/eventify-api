// src/__tests__/event.test.ts
import request from "supertest";
import app from "../app.js";
import prisma from "../lib/prisma.js";

let organizerToken: string;
let createdEventId: string;

async function loginAs(email: string, password = "password123") {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  return res.headers["set-cookie"]?.[0] ?? "";
}

beforeAll(async () => {
  organizerToken = await loginAs("organizer1@example.com");
});

afterAll(async () => {
  // cleanup event test
  if (createdEventId) {
    await prisma.event
      .delete({ where: { id: createdEventId } })
      .catch(() => {});
  }
  await prisma.$disconnect();
});

// ── GET /events ───────────────────────────────────────────────
describe("GET /api/events", () => {
  it("should return paginated events", async () => {
    const res = await request(app).get("/api/events");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty("total");
    expect(res.body.meta).toHaveProperty("page");
    expect(res.body.meta).toHaveProperty("totalPages");
  });

  it("should filter free events", async () => {
    const res = await request(app).get("/api/events?type=free");

    expect(res.status).toBe(200);
    res.body.data.forEach((event: any) => {
      expect(event.isFree).toBe(true);
    });
  });

  it("should filter paid events", async () => {
    const res = await request(app).get("/api/events?type=paid");

    expect(res.status).toBe(200);
    res.body.data.forEach((event: any) => {
      expect(event.isFree).toBe(false);
    });
  });

  it("should search events by title", async () => {
    const res = await request(app).get("/api/events?search=jazz");

    expect(res.status).toBe(200);
    // semua result harus relevan dengan kata jazz
    if (res.body.data.length > 0) {
      const hasJazz = res.body.data.some(
        (e: any) =>
          e.title.toLowerCase().includes("jazz") ||
          e.description?.toLowerCase().includes("jazz") ||
          e.location?.toLowerCase().includes("jazz"),
      );
      expect(hasJazz).toBe(true);
    }
  });

  it("should return empty data for non-existent search", async () => {
    const res = await request(app).get(
      "/api/events?search=xyznonexistentsearchterm999",
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });

  it("should paginate correctly", async () => {
    const res = await request(app).get("/api/events?page=1&limit=2");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.page).toBe(1);
  });
});

// ── GET /events/:id ───────────────────────────────────────────
describe("GET /api/events/:id", () => {
  it("should return event detail", async () => {
    const listRes = await request(app).get("/api/events");
    const eventId = listRes.body.data[0]?.id;
    if (!eventId) return;

    const res = await request(app).get(`/api/events/${eventId}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data).toHaveProperty("title");
    expect(res.body.data).toHaveProperty("averageRating");
  });

  it("should return 404 for non-existent event", async () => {
    const res = await request(app).get(
      "/api/events/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status).toBe(404);
  });
});

// ── GET /categories ───────────────────────────────────────────
describe("GET /api/events/categories", () => {
  it("should return list of categories", async () => {
    const res = await request(app).get("/api/events/categories");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ── POST /events ──────────────────────────────────────────────
describe("POST /api/events", () => {
  it("should return 401 if not logged in", async () => {
    const res = await request(app).post("/api/events").send({
      title: "Test Event",
    });
    expect(res.status).toBe(401);
  });

  it("should return 403 if customer tries to create event", async () => {
    const customerToken = await loginAs("customer1@example.com");
    const res = await request(app)
      .post("/api/events")
      .set("Cookie", customerToken)
      .send({ title: "Test Event" });

    expect(res.status).toBe(403);
  });

  it("should create event successfully as organizer", async () => {
    const categoryRes = await request(app).get("/api/events/categories");
    const categoryId = categoryRes.body.data[0]?.id;

    const res = await request(app)
      .post("/api/events")
      .set("Cookie", organizerToken)
      .send({
        title: "Test Event by Jest",
        categoryId,
        description: "This is a test event created by Jest unit test",
        location: "Test Location, Jakarta",
        startDate: "2026-06-01T09:00:00Z",
        endDate: "2026-06-01T17:00:00Z",
        price: 100000,
        availableSeats: 50,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Test Event by Jest");
    expect(res.body.data.isFree).toBe(false);
    createdEventId = res.body.data.id;
  });

  it("should set isFree true when price is 0", async () => {
    const categoryRes = await request(app).get("/api/events/categories");
    const categoryId = categoryRes.body.data[0]?.id;

    const res = await request(app)
      .post("/api/events")
      .set("Cookie", organizerToken)
      .send({
        title: "Free Test Event by Jest",
        categoryId,
        description: "This is a free test event created by Jest unit test",
        location: "Test Location, Bandung",
        startDate: "2026-07-01T09:00:00Z",
        endDate: "2026-07-01T17:00:00Z",
        price: 0,
        availableSeats: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.isFree).toBe(true);
    expect(res.body.data.price).toBe(0);

    // cleanup
    await prisma.event
      .delete({ where: { id: res.body.data.id } })
      .catch(() => {});
  });

  it("should return 400 if endDate before startDate", async () => {
    const categoryRes = await request(app).get("/api/events/categories");
    const categoryId = categoryRes.body.data[0]?.id;

    const res = await request(app)
      .post("/api/events")
      .set("Cookie", organizerToken)
      .send({
        title: "Bad Date Event",
        categoryId,
        description: "Event with invalid dates for testing",
        location: "Test Location",
        startDate: "2026-06-01T17:00:00Z",
        endDate: "2026-06-01T09:00:00Z", // endDate sebelum startDate
        price: 0,
        availableSeats: 10,
      });

    expect(res.status).toBe(400);
  });
});

// ── review ────────────────────────────────────────────────────
describe("POST /api/events/:id/reviews", () => {
  it("should return 400 if event is not completed", async () => {
    const customerToken = await loginAs("customer1@example.com");
    const listRes = await request(app).get("/api/events?status=PUBLISHED");
    const eventId = listRes.body.data[0]?.id;
    if (!eventId) return;

    const res = await request(app)
      .post(`/api/events/${eventId}/reviews`)
      .set("Cookie", customerToken)
      .send({ rating: 5, comment: "Great event!" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("completed");
  });
});
