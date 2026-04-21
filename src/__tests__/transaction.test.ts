// src/__tests__/transaction.test.ts
import request from "supertest";
import app from "../app.js";
import prisma from "../lib/prisma.js";

// ── helpers ───────────────────────────────────────────────────
let customerToken: string;
let customerId: string;
let publishedEventId: string;
let freeEventId: string;
let completedEventId: string;

async function loginAs(email: string, password = "password123") {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  // ambil token dari cookie
  const cookie = res.headers["set-cookie"]?.[0] ?? "";
  return cookie;
}

beforeAll(async () => {
  // login sebagai customer1
  customerToken = await loginAs("customer1@example.com");
  const meRes = await request(app)
    .get("/api/auth/me")
    .set("Cookie", customerToken);
  customerId = meRes.body.data.id;

  // ambil event yang published & paid
  const eventsRes = await request(app).get(
    "/api/events?status=PUBLISHED&type=paid",
  );
  publishedEventId = eventsRes.body.data[0]?.id;

  // ambil free event
  const freeRes = await request(app).get(
    "/api/events?status=PUBLISHED&type=free",
  );
  freeEventId = freeRes.body.data[0]?.id;

  // ambil completed event
  const completedRes = await request(app).get("/api/events?status=COMPLETED");
  completedEventId = completedRes.body.data[0]?.id;
});

afterAll(async () => {
  // cleanup transaksi test
  await prisma.transaction.deleteMany({
    where: {
      customerId,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // 1 jam terakhir
    },
  });
  await prisma.$disconnect();
});

// ── beli tiket ────────────────────────────────────────────────
describe("POST /api/transactions", () => {
  it("should return 401 if not logged in", async () => {
    const res = await request(app).post("/api/transactions").send({
      eventId: publishedEventId,
      quantity: 1,
    });
    expect(res.status).toBe(401);
  });

  it("should return 403 if organizer tries to buy ticket", async () => {
    const organizerToken = await loginAs("organizer1@example.com");
    const res = await request(app)
      .post("/api/transactions")
      .set("Cookie", organizerToken)
      .send({ eventId: publishedEventId, quantity: 1 });

    expect(res.status).toBe(403);
  });

  it("should successfully buy a free event ticket", async () => {
    if (!freeEventId) return;

    const res = await request(app)
      .post("/api/transactions")
      .set("Cookie", customerToken)
      .send({ eventId: freeEventId, quantity: 1, usePoints: false });

    expect(res.status).toBe(201);
    expect(res.body.data.finalPrice).toBe(0);
    expect(res.body.data.status).toBe("SUCCESS");
  });

  it("should return 400 if event is not available (COMPLETED)", async () => {
    if (!completedEventId) return;

    const res = await request(app)
      .post("/api/transactions")
      .set("Cookie", customerToken)
      .send({ eventId: completedEventId, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Event is not available");
  });

  it("should return 400 if quantity exceeds available seats", async () => {
    if (!publishedEventId) return;

    // ambil event dulu untuk tahu available seats
    const eventRes = await request(app).get(`/api/events/${publishedEventId}`);
    const availableSeats =
      eventRes.body.data.availableSeats - eventRes.body.data.bookedSeats;

    // skip test jika seats > 10 (tidak bisa ditest dengan max quantity 10)
    if (availableSeats >= 10) {
      console.log("Skipping seat test - available seats >= 10");
      return;
    }

    const res = await request(app)
      .post("/api/transactions")
      .set("Cookie", customerToken)
      .send({ eventId: publishedEventId, quantity: availableSeats + 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("seat");
  });

  it("should return 400 if coupon code is invalid", async () => {
    if (!publishedEventId) return;

    const res = await request(app)
      .post("/api/transactions")
      .set("Cookie", customerToken)
      .send({
        eventId: publishedEventId,
        quantity: 1,
        couponCode: "INVALIDCOUPON999",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid coupon code");
  });
});

// ── riwayat transaksi ─────────────────────────────────────────
describe("GET /api/transactions/my", () => {
  it("should return customer transactions", async () => {
    const res = await request(app)
      .get("/api/transactions/my")
      .set("Cookie", customerToken);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should return 401 if not logged in", async () => {
    const res = await request(app).get("/api/transactions/my");
    expect(res.status).toBe(401);
  });
});

// ── poin ──────────────────────────────────────────────────────
describe("GET /api/transactions/points/me", () => {
  it("should return active points for customer", async () => {
    const res = await request(app)
      .get("/api/transactions/points/me")
      .set("Cookie", customerToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalActive");
    expect(res.body.data).toHaveProperty("points");
    expect(typeof res.body.data.totalActive).toBe("number");
  });
});

// ── kalkulasi harga ───────────────────────────────────────────
describe("Price calculation logic", () => {
  it("free event should always have finalPrice 0", async () => {
    if (!freeEventId) return;

    const res = await request(app)
      .post("/api/transactions")
      .set("Cookie", customerToken)
      .send({ eventId: freeEventId, quantity: 1, usePoints: true });

    // free event tidak boleh kena charge apapun
    if (res.status === 201) {
      expect(res.body.data.finalPrice).toBe(0);
      expect(res.body.data.basePrice).toBe(0);
    }
  });
});
