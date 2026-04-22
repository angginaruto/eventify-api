// src/modules/event/event.controller.ts
import type { Request, Response } from "express";
import {
  createEventSchema,
  updateEventSchema,
  eventQuerySchema,
} from "./event.validation.js";
import * as eventService from "./event.service.js";

export async function getEvents(req: Request, res: Response) {
  const parsed = eventQuerySchema.safeParse(req.query); //
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid query parameters",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await eventService.getEvents(parsed.data); // panggil service getEvents
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch events";
    res.status(500).json({ message });
  }
}

export async function getEventById(req: Request, res: Response) {
  try {
    const event = await eventService.getEventById(req.params.id as string);
    res.status(200).json({ data: event });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch event";
    const status = message === "Event not found" ? 404 : 500;
    res.status(status).json({ message });
  }
}

export async function createEvent(req: Request, res: Response) {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const event = await eventService.createEvent(req.user!.id, parsed.data);
    res.status(201).json({ message: "Event created", data: event });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create event";
    res.status(500).json({ message });
  }
}

export async function updateEvent(req: Request, res: Response) {
  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const event = await eventService.updateEvent(
      req.params.id as string,
      req.user!.id as string,
      parsed.data,
    );
    res.status(200).json({ message: "Event updated", data: event });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update event";
    const status =
      message === "Event not found" ? 404 : message === "Forbidden" ? 403 : 500;
    res.status(status).json({ message });
  }
}

export async function deleteEvent(req: Request, res: Response) {
  try {
    await eventService.deleteEvent(
      req.params.id as string,
      req.user!.id as string,
    );
    res.status(200).json({ message: "Event deleted" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete event";
    const status =
      message === "Event not found" ? 404 : message === "Forbidden" ? 403 : 500;
    res.status(status).json({ message });
  }
}

export async function getOrganizerEvents(req: Request, res: Response) {
  const parsed = eventQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid query parameters",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await eventService.getOrganizerEvents(
      req.user!.id,
      parsed.data,
    );
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch events";
    res.status(500).json({ message });
  }
}

export async function getCategories(_req: Request, res: Response) {
  try {
    const categories = await eventService.getCategories();
    res.status(200).json({ data: categories });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch categories" });
  }
}
