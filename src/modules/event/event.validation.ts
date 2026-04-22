// Zod dipakai untuk memastikan data dari client itu valid sebelum masuk ke business logic dan database, sekaligus menjaga type safety karena schema bisa langsung di-infer jadi TypeScript type.

// src/modules/event/event.validation.ts
import { z } from "zod";

// base schema tanpa refine — dipakai untuk update (partial)
const eventBaseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  categoryId: z.string().uuid("Invalid category ID"), // uuid artinya harus string dengan format UUID
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
  (data) => data.endDate > data.startDate, // endDate harus setelah startDate
  {
    message: "End date must be after start date",
    path: ["endDate"],
  },
);

// update schema pakai base (tanpa refine) supaya bisa .partial()
export const updateEventSchema = eventBaseSchema.partial().extend({
  // dengan partial semua field jadi optional, extend untuk tambah field status
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]).optional(),
});

// helper: ambil string pertama jika array (Express query params bisa string | string[])
const qstr = z
  .union([z.string(), z.array(z.string())]) // bisa string atau array of string
  .transform((val) => (Array.isArray(val) ? val[0] : val)) // ambil string pertama jika array
  .optional();

export const eventQuerySchema = z.object({
  search: qstr, // untuk search by title atau description
  categoryId: qstr, // filter by category
  location: qstr, // filter by location
  type: qstr.pipe(z.enum(["free", "paid"]).optional()),
  status: qstr.pipe(
    // pipe untuk lanjut validasi enum setelah transform string pertama
    z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]).optional(),
  ),
  startDate: z // untuk filter events yang mulai setelah startDate tertentu
    .union([z.string(), z.array(z.string())]) // bisa string atau array of string
    .transform((val) => (Array.isArray(val) ? val[0] : val)) // ambil string pertama jika array
    .transform((val) => (val ? new Date(val) : undefined)) // ubah ke Date jika ada, kalau tidak biarkan undefined
    .optional(),
  page: z // untuk pagination, default 1 jika tidak ada atau invalid
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return 1;
      const s = Array.isArray(val) ? val[0] : val; // ambil string pertama jika array
      const n = parseInt(s, 10); // parse ke integer
      return isNaN(n) || n < 1 ? 1 : n; // default 1 jika NaN atau kurang dari 1, maksimal 100 untuk mencegah abuse
    }),
  limit: z // untuk limit jumlah hasil yang ditampilkan, default 10 jika tidak ada atau invalid
    .union([z.string(), z.array(z.string())]) // bisa string atau array of string
    .optional()
    .transform((val) => {
      if (!val) return 10;
      const s = Array.isArray(val) ? val[0] : val;
      const n = parseInt(s, 10);
      return isNaN(n) || n < 1 ? 10 : Math.min(n, 50); // default 10 jika NaN atau kurang dari 1, maksimal 50 untuk mencegah abuse
    }),
});

export type CreateEventInput = z.infer<typeof createEventSchema>; // tipe untuk input create event, di-infer langsung dari schema
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventQuery = z.infer<typeof eventQuerySchema>;
