// src/modules/promotion/promotion.validation.ts
import { z } from "zod";

export const createPromotionSchema = z
  .object({
    type: z.enum(["DATE_BASED", "REFERRAL"]),
    discountValue: z.number().int().min(1, "Discount must be at least 1"),
    // REFERRAL only
    code: z.string().min(3).max(20).optional(),
    quota: z.number().int().min(1).optional(),
    // DATE_BASED only
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "REFERRAL") {
        return !!data.code && !!data.quota;
      }
      return true;
    },
    { message: "Referral promotion requires code and quota", path: ["code"] },
  )
  .refine(
    (data) => {
      if (data.type === "DATE_BASED") {
        return !!data.startDate && !!data.endDate;
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
        return data.endDate > data.startDate;
      }
      return true;
    },
    { message: "End date must be after start date", path: ["endDate"] },
  );

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
