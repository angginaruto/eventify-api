// src/middlewares/response.middleware.ts

import express from "express";
import { ApiResponse, ApiError } from "../types/response.js";

declare global {
  namespace Express {
    interface Response {
      sendSuccess<T>(data: T, message: string, statusCode?: number): void;
      sendError(statusCode: number, message: string, code?: string): void;
    }
  }
}

export const responseMiddleware = (
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  res.sendSuccess = function <T>(data: T, message: string, statusCode = 200) {
    const response: ApiResponse<T> = {
      data,
      message,
      status: statusCode,
      success: true,
    };
    return this.status(statusCode).json(response);
  };

  res.sendError = function (statusCode: number, message: string, code?: string) {
    const response: ApiResponse = {
      data: null,
      message,
      status: statusCode,
      success: false,
    };
    // Include code if provided for frontend error handling
    if (code) {
      (response as any).code = code;
    }
    return this.status(statusCode).json(response);
  };

  next();
};

export const errorHandler = (
  err: any,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  console.error("Error:", err);

  if (err instanceof ApiError) {
    return res.sendError(err.statusCode, err.message, err.code);
  }

  if (err.name === "ZodError") {
    const issues = err.errors.map(
      (e: any) => `${e.path.join(".")}: ${e.message}`,
    );
    return res.sendError(400, `Validation error: ${issues.join(", ")}`, "VALIDATION_ERROR");
  }

  if (err.name === "JsonWebTokenError") {
    return res.sendError(401, "Invalid token", "INVALID_TOKEN");
  }

  if (err.name === "TokenExpiredError") {
    return res.sendError(401, "Token expired", "TOKEN_EXPIRED");
  }

  // Default error
  res.sendError(
    500,
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error",
  );
};
