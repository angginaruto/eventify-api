// src/modules/dashboard/dashboard.controller.ts
import type { Request, Response } from "express";
import * as dashboardService from "./dashboard.service.js";

export async function getDashboardStats(req: Request, res: Response) {
  const range = (req.query.range as string) || "month";

  if (!["day", "month", "year"].includes(range)) {
    res
      .status(400)
      .json({ message: "Range must be 'day', 'month', or 'year'" });
    return;
  }

  try {
    const stats = await dashboardService.getDashboardStats(
      req.user!.id as string,
      range as "day" | "month" | "year",
    );
    res.status(200).json({ data: stats });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
}

export async function getOrganizerEventStats(req: Request, res: Response) {
  try {
    const events = await dashboardService.getOrganizerEventStats(
      req.user!.id as string,
    );
    res.status(200).json({ data: events });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch event stats" });
  }
}
