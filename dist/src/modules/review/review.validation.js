// src/modules/review/review.validation.ts
import { z } from "zod";
export const createReviewSchema = z.object({
    rating: z
        .number()
        .int()
        .min(1, "Rating minimum 1")
        .max(5, "Rating maksimum 5"),
    comment: z
        .string()
        .min(10, "Comment must be at least 10 characters")
        .optional(),
});
