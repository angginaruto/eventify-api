// src/modules/auth/auth.service.ts
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { addMonths } from "date-fns";
import prisma from "../../lib/prisma.js";
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";
// ── helperssss ──────────────────────────────────────────────────
function generateReferralCode(name) {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${name.substring(0, 3).toUpperCase()}${rand}`;
}
function generateCouponCode() {
    return "COUP-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}
// ── registerrrr ─────────────────────────────────────────────────
export async function register(input) {
    const { name, email, password, role, referralCode } = input;
    // periksa email duplikat cuy
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new Error("Email already registered");
    }
    // cek referral code valid atau enggak (jika diisi)
    let referralOwner = null;
    if (referralCode) {
        referralOwner = await prisma.user.findUnique({
            where: { referralCode },
        });
        if (!referralOwner) {
            throw new Error("Invalid referral code");
        }
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = generateReferralCode(name);
    const now = new Date();
    // atomic transaction: buat user + poin untuk pemilik referral + coupon buat pendaftar
    const user = await prisma.$transaction(async (tx) => {
        // 1. bikin user baru
        const newUser = await tx.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role,
                referralCode: newReferralCode,
            },
        });
        // 2. kalau pakai referral: kasih poin ke pemilik + coupon ke pendaftar
        if (referralOwner) {
            // poin 10.000 untuk pemilik referral (expires 3 bulan)
            await tx.point.create({
                data: {
                    userId: referralOwner.id,
                    amount: 10000,
                    expiresAt: addMonths(now, 3),
                },
            });
            // coupon diskon 10% buat pendaftar (expires 3 bulan)
            await tx.discountCoupon.create({
                data: {
                    userId: newUser.id,
                    code: generateCouponCode(),
                    discount: 10,
                    expiresAt: addMonths(now, 3),
                },
            });
        }
        return newUser;
    });
    // generate JWT
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            referralCode: user.referralCode,
        },
    };
}
// ── login ─────────────────────────────────────────────────────
export async function login(input) {
    const { email, password } = input;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new Error("Invalid email or password");
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        throw new Error("Invalid email or password");
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            referralCode: user.referralCode,
            avatarUrl: user.avatarUrl,
        },
    };
}
// ── part getMe ─────────────────────────────────────────────────────
export async function getMe(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            referralCode: true,
            avatarUrl: true,
            createdAt: true,
        },
    });
    if (!user)
        throw new Error("User not found");
    return user;
}
