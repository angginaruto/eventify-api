// src/modules/promotion/promotion.router.ts
import { Router } from "express";
import { verifyToken, requireRole } from "../../middlewares/auth.middleware.js";
import * as promotionController from "./promotion.controller.js";

const router = Router({ mergeParams: true });

// GET /api/events/:id/promotions — organizer only
router.get(
  "/",
  verifyToken,
  requireRole("ORGANIZER"),
  promotionController.getEventPromotions,
);

// POST /api/events/:id/promotions — organizer only
router.post(
  "/",
  verifyToken,
  requireRole("ORGANIZER"),
  promotionController.createPromotion,
);

// DELETE /api/events/:id/promotions/:promotionId — organizer only
router.delete(
  "/:promotionId",
  verifyToken,
  requireRole("ORGANIZER"),
  promotionController.deletePromotion,
);

export default router;
