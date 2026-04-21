// src/app.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import {
  responseMiddleware,
  errorHandler,
} from "./middlewares/response.middleware.js";
import authRouter from "./modules/auth/auth.router.js";
import eventRouter from "./modules/event/event.router.js";
import transactionRouter from "./modules/transaction/transaction.router.js";
import reviewRouter from "./modules/review/review.router.js";
import dashboardRouter from "./modules/dashboard/dashboard.router.js";
import promotionRouter from "./modules/promotion/promotion.router.js";

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration with strict whitelist
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(responseMiddleware);

app.use("/api/auth", authRouter);
app.use("/api/events", eventRouter);
app.use("/api/events/:id/reviews", reviewRouter);
app.use("/api/events/:id/promotions", promotionRouter);
app.use("/api/transactions", transactionRouter);
app.use("/api/dashboard", dashboardRouter);

// validate promo code (public — dipakai saat checkout)
app.post("/api/promotions/validate", (req, res) => {
  import("./modules/promotion/promotion.controller.js").then((m) =>
    m.validatePromoCode(req, res),
  );
});

app.get("/", (_req, res) => {
  res.sendSuccess(
    { version: "1.0.0", environment: process.env.NODE_ENV || "development" },
    "Event Management API is running 🚀",
  );
});

// Global error handler (must be last)
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.sendError(404, "Endpoint not found", "NOT_FOUND");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
