// src/modules/transaction/transaction.controller.ts
import type { Request, Response } from "express";
import { createTransactionSchema } from "./transaction.validation.js";
import * as transactionService from "./transaction.service.js";

export async function createTransaction(req: Request, res: Response) {
  const parsed = createTransactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await transactionService.createTransaction(
      req.user!.id as string,
      parsed.data,
    );
    res.status(201).json({
      message: "Transaction created",
      data: {
        transaction: result.transaction,
        snapToken: result.snapToken,
        paymentUrl: result.paymentUrl,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transaction failed";
    const status =
      message === "Event not found"
        ? 404
        : message === "Event is not available"
          ? 400
          : message.includes("seat")
            ? 400
            : message.includes("oupon")
              ? 400
              : 500;
    res.status(status).json({ message });
  }
}

export async function handleWebhook(req: Request, res: Response) {
  try {
    const result = await transactionService.handleMidtransWebhook(req.body); // panggil service handleMidtransWebhook
    res.status(200).json({ message: "Webhook processed", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    res.status(400).json({ message });
  }
}

export async function getMyTransactions(req: Request, res: Response) {
  try {
    const transactions = await transactionService.getMyTransactions(
      req.user!.id as string,
    );
    res.status(200).json({ data: transactions });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
}

export async function getEventTransactions(req: Request, res: Response) {
  try {
    const transactions = await transactionService.getEventTransactions(
      req.params.id as string,
      req.user!.id as string,
    );
    res.status(200).json({ data: transactions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch transactions";
    const status =
      message === "Event not found" ? 404 : message === "Forbidden" ? 403 : 500;
    res.status(status).json({ message });
  }
}

export async function getMyPoints(req: Request, res: Response) {
  try {
    const points = await transactionService.getMyPoints(req.user!.id as string);
    res.status(200).json({ data: points });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch points" });
  }
}

export async function getMyCoupons(req: Request, res: Response) {
  try {
    const coupons = await transactionService.getMyCoupons(
      req.user!.id as string,
    );
    res.status(200).json({ data: coupons });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch coupons" });
  }
}
