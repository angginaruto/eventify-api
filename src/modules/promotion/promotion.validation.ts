// src/modules/promotion/promotion.validation.ts
import { z } from "zod";

export const createPromotionSchema = z
  .object({
    type: z.enum(["DATE_BASED", "REFERRAL"]),
    discountValue: z.number().int().min(1, "Discount must be at least 1"),
    // REFERRAL only
    code: z.string().min(3).max(20).optional(), // kode referal unik, 3-20 karakter
    quota: z.number().int().min(1).optional(), // jumlah maksimal penggunaan kode referal
    // DATE_BASED only
    startDate: z.coerce.date().optional(), // tanggal mulai berlakunya promosi
    endDate: z.coerce.date().optional(), // tanggal berakhirnya promosi
  })
  .refine(
    (data) => {
      if (data.type === "REFERRAL") {
        return !!data.code && !!data.quota; // code dan quota harus ada
      }
      return true;
    },
    { message: "Referral promotion requires code and quota", path: ["code"] },
  )
  .refine(
    (data) => {
      if (data.type === "DATE_BASED") {
        return !!data.startDate && !!data.endDate; // startDate dan endDate harus ada
      }
      return true;
    },
    {
      message: "Date-based promotion requires startDate and endDate",
      path: ["startDate"],
    },
  )
  .refine(
    (data) => {
      if (data.type === "DATE_BASED" && data.startDate && data.endDate) {
        return data.endDate > data.startDate; // endDate harus setelah startDate
      }
      return true;
    },
    { message: "End date must be after start date", path: ["endDate"] },
  );

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
