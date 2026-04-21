// src/modules/promotion/promotion.service.ts
import prisma from "../../lib/prisma.js";
import type { CreatePromotionInput } from "./promotion.validation.js";

// ── POST /events/:id/promotions ───────────────────────────────

export async function createPromotion(
  eventId: string,
  organizerId: string,
  input: CreatePromotionInput,
) {
  // cek event exist & milik organizer ini
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  if (event.organizerId !== organizerId) throw new Error("Forbidden");
  if (event.status === "CANCELLED" || event.status === "COMPLETED") {
    throw new Error("Cannot add promotion to a cancelled or completed event");
  }

  // cek duplikat code jika REFERRAL
  if (input.type === "REFERRAL" && input.code) {
    const existing = await prisma.promotion.findUnique({
      where: { code: input.code },
    });
    if (existing) throw new Error("Promotion code already exists");
  }

  const promotion = await prisma.promotion.create({
    data: {
      eventId,
      type: input.type,
      discountValue: input.discountValue,
      code: input.code ?? null,
      quota: input.quota ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    },
  });

  return promotion;
}

// ── GET /events/:id/promotions ────────────────────────────────

export async function getEventPromotions(eventId: string, organizerId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  if (event.organizerId !== organizerId) throw new Error("Forbidden");

  const promotions = await prisma.promotion.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });

  return promotions;
}

// ── DELETE /promotions/:id ────────────────────────────────────

export async function deletePromotion(
  promotionId: string,
  organizerId: string,
) {
  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
    include: { event: { select: { organizerId: true } } },
  });

  if (!promotion) throw new Error("Promotion not found");
  if (promotion.event.organizerId !== organizerId) throw new Error("Forbidden");

  // jika sudah dipakai, tidak bisa dihapus
  if (promotion.usedCount > 0) {
    throw new Error("Cannot delete promotion that has already been used");
  }

  await prisma.promotion.delete({ where: { id: promotionId } });
}

// ── POST /promotions/validate — cek promo code sebelum checkout

export async function validatePromoCode(code: string, eventId: string) {
  const promotion = await prisma.promotion.findUnique({ where: { code } });

  if (!promotion) throw new Error("Invalid promotion code");
  if (promotion.eventId !== eventId) {
    throw new Error("Promotion code is not valid for this event");
  }

  // cek quota
  if (promotion.quota !== null && promotion.usedCount >= promotion.quota) {
    throw new Error("Promotion quota has been reached");
  }

  // cek tanggal jika DATE_BASED
  if (promotion.type === "DATE_BASED") {
    const now = new Date();
    if (promotion.startDate && now < promotion.startDate) {
      throw new Error("Promotion has not started yet");
    }
    if (promotion.endDate && now > promotion.endDate) {
      throw new Error("Promotion has expired");
    }
  }

  return {
    id: promotion.id,
    code: promotion.code,
    discountValue: promotion.discountValue,
    type: promotion.type,
  };
}
