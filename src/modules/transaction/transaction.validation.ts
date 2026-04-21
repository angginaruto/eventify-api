// src/modules/transaction/transaction.validation.ts
import { z } from "zod";

export const createTransactionSchema = z.object({
  eventId: z.string().uuid("Invalid event ID"),
  quantity: z.number().int().min(1).max(10),
  couponCode: z.string().optional(), // kode kupon referralalalala
  usePoints: z.boolean().default(false), // pake poin atau enggak
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
