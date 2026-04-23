// src/modules/transaction/transaction.service.ts
import prisma from "../../lib/prisma.js";
import { snap } from "../../lib/mditrans.js";
import type { CreateTransactionInput } from "./transaction.validation.js";

// ── helper: hitung total poin aktif user ─────────────────────

async function getActivePoints(userId: string): Promise<number> {
  const result = await prisma.point.aggregate({
    where: {
      userId,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

// ── helper: kurangi poin ─────────────────────────────────────

async function redeemPoints(
  tx: any,
  userId: string,
  pointsNeeded: number,
): Promise<void> {
  const points = await tx.point.findMany({
    where: {
      userId,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "asc" },
  });

  let remaining = pointsNeeded;
  for (const point of points) {
    if (remaining <= 0) break;
    if (point.amount <= remaining) {
      await tx.point.update({
        where: { id: point.id },
        data: { status: "USED", redeemedAt: new Date() },
      });
      remaining -= point.amount; // kurangi remaining dengan jumlah poin yang sudah dipakai
    } else {
      await tx.point.update({
        where: { id: point.id },
        data: { amount: point.amount - remaining }, // update jumlah poin yang tersisa
      });
      remaining = 0;
    }
  }
}

// ── POST /transactions ────────────────────────────────────────

export async function createTransaction(
  customerId: string,
  input: CreateTransactionInput,
) {
  const { eventId, quantity, couponCode, usePoints } = input;

  // 1. cek event
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  if (event.status !== "PUBLISHED") throw new Error("Event is not available");

  // 2. cek seats
  const seatsLeft = event.availableSeats - event.bookedSeats;
  if (seatsLeft < quantity)
    throw new Error(`Only ${seatsLeft} seat(s) available`);

  // 3. cek kupon
  // 3. cek kupon / promo
  let coupon = null;
  let referralPromo = null;

  if (couponCode) {
    // cek user coupon
    coupon = await prisma.discountCoupon.findUnique({
      where: { code: couponCode },
    });

    if (coupon) {
      if (coupon.userId !== customerId)
        throw new Error("Coupon does not belong to you");
      if (coupon.isUsed) throw new Error("Coupon has already been used");
      if (coupon.expiresAt < new Date()) throw new Error("Coupon has expired");
    } else {
      // cek referral promo
      referralPromo = await prisma.promotion.findFirst({
        where: {
          eventId,
          type: "REFERRAL",
          code: couponCode,
        },
      });

      if (!referralPromo) throw new Error("Invalid coupon code");

      if (
        referralPromo.quota !== null &&
        referralPromo.usedCount >= referralPromo.quota
      ) {
        throw new Error("Promo quota exceeded");
      }
    }
  }

  // 4. kalkulasi harga
  const basePrice = event.price * quantity;
  let discountAmount = 0;

  if (coupon) {
    discountAmount = Math.floor((basePrice * coupon.discount) / 100);
  }

  if (referralPromo) {
    discountAmount += referralPromo.discountValue * quantity;
  }
  let pointsUsed = 0;

  if (coupon) {
    discountAmount = Math.floor((basePrice * coupon.discount) / 100);
  }

  const now = new Date();

  const activePromos = await prisma.promotion.findMany({
    where: {
      eventId,
      type: "DATE_BASED",
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });

  let autoDiscountAmount = 0;

  if (activePromos.length > 0) {
    const bestPromo = activePromos.reduce((max, p) =>
      p.discountValue > max.discountValue ? p : max,
    );

    autoDiscountAmount = bestPromo.discountValue * quantity;
  }

  const totalDiscount = discountAmount + autoDiscountAmount;

  if (usePoints && !event.isFree) {
    const activePoints = await getActivePoints(customerId);
    const priceAfterDiscount = basePrice - totalDiscount;

    pointsUsed = Math.min(activePoints, priceAfterDiscount);
  }

  const finalPrice = Math.max(0, basePrice - totalDiscount - pointsUsed);

  // 5. ambil data customer
  const customer = await prisma.user.findUnique({
    where: { id: customerId },
    select: { name: true, email: true },
  });

  // 6. atomic transaction — buat record dulu dengan status PENDING
  const transaction = await prisma.$transaction(async (tx) => {
    // kurangi seats
    await tx.event.update({
      where: { id: eventId },
      data: { bookedSeats: { increment: quantity } },
    });

    // buat transaksi dengan status PENDING
    const newTx = await tx.transaction.create({
      data: {
        customerId,
        eventId,
        quantity,
        basePrice,
        discountAmount,
        pointsUsed,
        finalPrice,
        status: "PENDING",
        ...(coupon && { couponId: coupon.id }),
      },
    });

    // tandai kupon used
    if (coupon) {
      await tx.discountCoupon.update({
        where: { id: coupon.id },
        data: { isUsed: true, usedAt: new Date() },
      });
    }
    if (referralPromo) {
      await tx.promotion.update({
        where: { id: referralPromo.id },
        data: {
          usedCount: { increment: quantity },
        },
      });
    }
    // kurangi poin
    if (pointsUsed > 0) {
      await redeemPoints(tx, customerId, pointsUsed);
    }

    return newTx;
  });

  // 7. jika free event, langsung SUCCESS tanpa Midtrans
  if (finalPrice === 0) {
    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: "SUCCESS" },
      include: {
        event: {
          select: { id: true, title: true, startDate: true, location: true },
        },
      },
    });
    return { transaction: updated, snapToken: null, paymentUrl: null };
  }

  // 8. buat Snap token via Midtrans
  const snapParams = {
    transaction_details: {
      // kirim detail transaksi ke Midtrans
      order_id: transaction.id,
      gross_amount: finalPrice,
    },
    customer_details: {
      first_name: customer?.name ?? "Customer",
      email: customer?.email ?? "",
    },
    item_details: [
      {
        id: event.id,
        price: finalPrice,
        quantity: 1,
        name: `${event.title} (x${quantity})`,
      },
    ],
    callbacks: {
      finish: `${process.env.CLIENT_URL}/transactions?success=1`,
      error: `${process.env.CLIENT_URL}/transactions?error=1`,
      pending: `${process.env.CLIENT_URL}/transactions?pending=1`,
    },
  };

  const snapResponse = await snap.createTransaction(snapParams);

  // simpan snap token ke transaksi
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      snapToken: snapResponse.token,
      paymentUrl: snapResponse.redirect_url,
    },
  });

  return {
    transaction,
    snapToken: snapResponse.token,
    paymentUrl: snapResponse.redirect_url,
  };
}

// ── Webhook dari Midtrans ─────────────────────────────────────

export async function handleMidtransWebhook(notification: any) {
  const { order_id, transaction_status, fraud_status } = notification; // baca status midtrans

  const transaction = await prisma.transaction.findUnique({
    where: { id: order_id },
  });

  if (!transaction) throw new Error("Transaction not found");

  let newStatus: "PENDING" | "SUCCESS" | "CANCELLED" | "FAILED" = "PENDING";

  if (transaction_status === "capture") {
    // kalau diproses
    newStatus = fraud_status === "accept" ? "SUCCESS" : "FAILED";
  } else if (transaction_status === "settlement") {
    // kalau sudah selesai
    newStatus = "SUCCESS";
  } else if (
    // gagal
    transaction_status === "cancel" ||
    transaction_status === "deny" ||
    transaction_status === "expire"
  ) {
    newStatus = "CANCELLED";
    // kembalikan seats jika dibatalkan
    await prisma.event.update({
      where: { id: transaction.eventId },
      data: { bookedSeats: { decrement: transaction.quantity } }, // kursi dikembalikan jika gagal
    });
  } else if (transaction_status === "pending") {
    newStatus = "PENDING";
  }

  await prisma.transaction.update({
    where: { id: order_id },
    data: { status: newStatus },
  });

  return { status: newStatus };
}

// ── GET /transactions (customer) ──────────────────────────────

export async function getMyTransactions(customerId: string) {
  return await prisma.transaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          startDate: true,
          location: true,
          imageUrl: true,
          isFree: true,
        },
      },
      coupon: { select: { code: true, discount: true } },
    },
  });
}

// ── GET /transactions/event/:id (organizer) ───────────────────

export async function getEventTransactions(
  eventId: string,
  organizerId: string,
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  if (event.organizerId !== organizerId) throw new Error("Forbidden");

  return await prisma.transaction.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true, email: true } },
    },
  });
}

// ── GET /points/me ────────────────────────────────────────────

export async function getMyPoints(userId: string) {
  const points = await prisma.point.findMany({
    where: { userId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "asc" },
  });
  const totalActive = points.reduce((sum, p) => sum + p.amount, 0);
  return { totalActive, points };
}

// ── GET /coupons/me ───────────────────────────────────────────

export async function getMyCoupons(userId: string) {
  return await prisma.discountCoupon.findMany({
    where: { userId, isUsed: false, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "asc" },
  });
}
