// src/modules/dashboard/dashboard.router.ts
import { Router } from "express";
import { verifyToken, requireRole } from "../../middlewares/auth.middleware.js";
import * as dashboardController from "./dashboard.controller.js";

const router = Router();

// semua dashboard route organizer only
router.use(verifyToken, requireRole("ORGANIZER"));

// GET /api/dashboard/stats?range=day|month|year
router.get("/stats", dashboardController.getDashboardStats);

// GET /api/dashboard/events — list event + stats lengkap
router.get("/events", dashboardController.getOrganizerEventStats);

export default router;
