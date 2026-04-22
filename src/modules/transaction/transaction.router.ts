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
  transactionController.getMyTransactions, // route untuk customer melihat transaksi-transaksi yang dia lakukan
);
router.get(
  "/points/me",
  verifyToken,
  requireRole("CUSTOMER"),
  transactionController.getMyPoints, // route untuk customer melihat jumlah poin yang dia punya
);
router.get(
  "/coupons/me",
  verifyToken,
  requireRole("CUSTOMER"),
  transactionController.getMyCoupons, // route untuk customer melihat daftar kupon yang dia punya
);

// Organizer routes
router.get(
  "/event/:id",
  verifyToken,
  requireRole("ORGANIZER"),
  transactionController.getEventTransactions, // route untuk organizer melihat transaksi-transaksi yang terjadi di event yang dia buat
);

export default router;
