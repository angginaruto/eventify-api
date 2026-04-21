// src/__tests__/auth.test.ts
import request from "supertest";
import app from "../app.js";
import prisma from "../lib/prisma.js";

// ── cleanup ───────────────────────────────────────────────────
afterEach(async () => {
  await prisma.discountCoupon.deleteMany({
    where: { user: { email: { contains: "test_auth" } } },
  });
  await prisma.point.deleteMany({
    where: { user: { email: { contains: "test_auth" } } },
  });
  await prisma.user.deleteMany({ where: { email: { contains: "test_auth" } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ── register ──────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  it("should register a new customer successfully", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "test_auth_1@example.com",
      password: "password123",
      role: "CUSTOMER",
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Register successful");
    expect(res.body.data.email).toBe("test_auth_1@example.com");
    expect(res.body.data.role).toBe("CUSTOMER");
    expect(res.body.data).not.toHaveProperty("password");
  });

  it("should register a new organizer successfully", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test Organizer",
      email: "test_auth_org@example.com",
      password: "password123",
      role: "ORGANIZER",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe("ORGANIZER");
  });

  it("should return 409 if email already registered", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "test_auth_dup@example.com",
      password: "password123",
      role: "CUSTOMER",
    });

    const res = await request(app).post("/api/auth/register").send({
      name: "Test User 2",
      email: "test_auth_dup@example.com",
      password: "password123",
      role: "CUSTOMER",
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Email already registered");
  });

  it("should return 400 if referral code is invalid", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "test_auth_ref@example.com",
      password: "password123",
      role: "CUSTOMER",
      referralCode: "INVALIDCODE999",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid referral code");
  });

  it("should give points to referral owner and coupon to new user when valid referral used", async () => {
    // buat owner referral
    const ownerRes = await request(app).post("/api/auth/register").send({
      name: "Referral Owner",
      email: "test_auth_owner@example.com",
      password: "password123",
      role: "CUSTOMER",
    });
    const referralCode = ownerRes.body.data.referralCode;

    // daftar pakai referral
    const res = await request(app).post("/api/auth/register").send({
      name: "New User",
      email: "test_auth_newuser@example.com",
      password: "password123",
      role: "CUSTOMER",
      referralCode,
    });

    expect(res.status).toBe(201);

    // cek poin owner bertambah
    const ownerPoints = await prisma.point.findFirst({
      where: { user: { email: "test_auth_owner@example.com" } },
    });
    expect(ownerPoints).not.toBeNull();
    expect(ownerPoints?.amount).toBe(10000);

    // cek coupon new user
    const newUserCoupon = await prisma.discountCoupon.findFirst({
      where: { user: { email: "test_auth_newuser@example.com" } },
    });
    expect(newUserCoupon).not.toBeNull();
    expect(newUserCoupon?.discount).toBe(10);
  });

  it("should return 400 if required fields missing", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "test_auth_missing@example.com",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
  });
});

// ── login ─────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login Test User",
      email: "test_auth_login@example.com",
      password: "password123",
      role: "CUSTOMER",
    });
  });

  it("should login successfully with correct credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "test_auth_login@example.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Login successful");
    expect(res.body.data.email).toBe("test_auth_login@example.com");
    // cookie harus di-set
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("should return 401 with wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "test_auth_login@example.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("should return 401 with non-existent email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "notexist@example.com",
      password: "password123",
    });

    expect(res.status).toBe(401);
  });
});
