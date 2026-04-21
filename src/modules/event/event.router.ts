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
  "/organizer/my-events",
  verifyToken,
  requireRole("ORGANIZER"),
  eventController.getOrganizerEvents,
);
router.post(
  "/",
  verifyToken,
  requireRole("ORGANIZER"),
  eventController.createEvent,
);
router.put(
  "/:id",
  verifyToken,
  requireRole("ORGANIZER"),
  eventController.updateEvent,
);
router.delete(
  "/:id",
  verifyToken,
  requireRole("ORGANIZER"),
  eventController.deleteEvent,
);

export default router;
