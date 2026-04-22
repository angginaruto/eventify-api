// src/modules/promotion/promotion.controller.ts
import type { Request, Response } from "express";
import { createPromotionSchema } from "./promotion.validation.js";
import * as promotionService from "./promotion.service.js";

export async function createPromotion(req: Request, res: Response) {
  const parsed = createPromotionSchema.safeParse(req.body); // validasi input
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const promotion = await promotionService.createPromotion(
      req.params.id as string, // hasil dari url yg dipanggil user, yaitu eventId
      req.user!.id as string,
      parsed.data,
    );
    res.status(201).json({ message: "Promotion created", data: promotion });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create promotion";
    const status =
      message === "Event not found"
        ? 404
        : message === "Forbidden"
          ? 403
          : message === "Promotion code already exists"
            ? 409
            : 400;
    res.status(status).json({ message });
  }
}

export async function getEventPromotions(req: Request, res: Response) {
  // cek event exist & milik organizer ini
  try {
    const promotions = await promotionService.getEventPromotions(
      req.params.id as string,
      req.user!.id as string,
    );
    res.status(200).json({ data: promotions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch promotions";
    const status =
      message === "Event not found" ? 404 : message === "Forbidden" ? 403 : 500;
    res.status(status).json({ message });
  }
}

export async function deletePromotion(req: Request, res: Response) {
  // cek promo exist & milik organizer ini
  try {
    await promotionService.deletePromotion(
      // service deletePromotion
      req.params.promotionId as string,
      req.user!.id as string,
    );
    res.status(200).json({ message: "Promotion deleted" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete promotion";
    const status =
      message === "Promotion not found"
        ? 404
        : message === "Forbidden"
          ? 403
          : message.includes("already been used")
            ? 400
            : 500;
    res.status(status).json({ message });
  }
}

export async function validatePromoCode(req: Request, res: Response) {
  const { code, eventId } = req.body;

  if (!code || !eventId) {
    // validasi input sederhana
    res.status(400).json({ message: "code and eventId are required" });
    return;
  }

  try {
    const promotion = await promotionService.validatePromoCode(code, eventId);
    res.status(200).json({ data: promotion });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid promotion code";
    res.status(400).json({ message });
  }
}
