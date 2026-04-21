// src/modules/event/event.validation.ts
import { z } from "zod";

// base schema tanpa refine — dipakai untuk update (partial)
const eventBaseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  categoryId: z.string().uuid("Invalid category ID"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  location: z.string().min(3, "Location is required"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  price: z.number().int().min(0, "Price cannot be negative"),
  availableSeats: z.number().int().min(1, "Must have at least 1 seat"),
  imageUrl: z.string().url().optional(),
});

// create schema pakai refine
export const createEventSchema = eventBaseSchema.refine(
  (data) => data.endDate > data.startDate,
  {
    message: "End date must be after start date",
    path: ["endDate"],
  },
);

// update schema pakai base (tanpa refine) supaya bisa .partial()
export const updateEventSchema = eventBaseSchema.partial().extend({
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]).optional(),
});

// helper: ambil string pertama jika array (Express query params bisa string | string[])
const qstr = z
  .union([z.string(), z.array(z.string())])
  .transform((val) => (Array.isArray(val) ? val[0] : val))
  .optional();

export const eventQuerySchema = z.object({
  search: qstr,
  categoryId: qstr,
  location: qstr,
  type: qstr.pipe(z.enum(["free", "paid"]).optional()),
  status: qstr.pipe(
    z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]).optional(),
  ),
  startDate: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val[0] : val))
    .transform((val) => (val ? new Date(val) : undefined))
    .optional(),
  page: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return 1;
      const s = Array.isArray(val) ? val[0] : val;
      const n = parseInt(s, 10);
      return isNaN(n) || n < 1 ? 1 : n;
    }),
  limit: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return 10;
      const s = Array.isArray(val) ? val[0] : val;
      const n = parseInt(s, 10);
      return isNaN(n) || n < 1 ? 10 : Math.min(n, 50);
    }),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventQuery = z.infer<typeof eventQuerySchema>;
