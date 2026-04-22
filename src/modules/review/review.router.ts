// src/modules/review/review.router.ts
import { Router } from "express";
import { verifyToken, requireRole } from "../../middlewares/auth.middleware.js";
import * as reviewController from "./review.controller.js";

// router ini di-mount di /api/events/:id/reviews
// jadi perlu mergeParams supaya bisa akses req.params.id dari parent router
const router = Router({ mergeParams: true });

// GET /api/events/:id/reviews — public
router.get("/", reviewController.getEventReviews);

// POST /api/events/:id/reviews — customer only
router.post(
  "/", // route untuk membuat review baru untuk event dengan id tertentu
  verifyToken,
  requireRole("CUSTOMER"),
  reviewController.createReview,
);

export default router;
