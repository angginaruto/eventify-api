// src/modules/event/event.router.ts
import { Router } from "express";
import { verifyToken, requireRole } from "../../middlewares/auth.middleware.js";
import * as eventController from "./event.controller.js";

const router = Router();

// Public routes
router.get("/", eventController.getEvents);
router.get("/categories", eventController.getCategories);
router.get("/:id", eventController.getEventById);

// Organizer only routes
router.get(
  // route untuk organizer melihat event-event yang dia buat
  "/organizer/my-events",
  verifyToken,
  requireRole("ORGANIZER"),
  eventController.getOrganizerEvents,
);
router.post(
  // route untuk organizer membuat event baru
  "/",
  verifyToken,
  requireRole("ORGANIZER"),
  eventController.createEvent,
);
router.put(
  // route untuk organizer mengupdate event yang dia buat
  "/:id",
  verifyToken,
  requireRole("ORGANIZER"),
  eventController.updateEvent,
);
router.delete(
  // route untuk organizer menghapus event yang dia buat
  "/:id",
  verifyToken,
  requireRole("ORGANIZER"),
  eventController.deleteEvent,
);

export default router;
