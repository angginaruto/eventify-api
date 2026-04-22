// src/modules/transaction/transaction.router.ts
import { Router } from "express";
import { verifyToken, requireRole } from "../../middlewares/auth.middleware.js";
import * as transactionController from "./transaction.controller.js";

const router = Router();

// Webhook dari Midtrans — public, tidak perlu auth
router.post("/webhook", transactionController.handleWebhook);

// Customer routes
router.post(
  "/",
  verifyToken,
  requireRole("CUSTOMER"),
  transactionController.createTransaction,
);
router.get(
  "/my",
  verifyToken,
  requireRole("CUSTOMER"),
  transactionController.getMyTransactions,
);
router.get(
  "/points/me",
  verifyToken,
  requireRole("CUSTOMER"),
  transactionController.getMyPoints,
);
router.get(
  "/coupons/me",
  verifyToken,
  requireRole("CUSTOMER"),
  transactionController.getMyCoupons,
);

// Organizer routes
router.get(
  "/event/:id",
  verifyToken,
  requireRole("ORGANIZER"),
  transactionController.getEventTransactions,
);

export default router;
