// src/middlewares/response.middleware.ts
import { ApiError } from "../types/response.js";
export const responseMiddleware = (_req, res, next) => {
    res.sendSuccess = function (data, message, statusCode = 200) {
        const response = {
            data,
            message,
            status: statusCode,
            success: true,
        };
        return this.status(statusCode).json(response);
    };
    res.sendError = function (statusCode, message, code) {
        const response = {
            data: null,
            message,
            status: statusCode,
            success: false,
        };
        // Include code if provided for frontend error handling
        if (code) {
            response.code = code;
        }
        return this.status(statusCode).json(response);
    };
    next();
};
export const errorHandler = (err, _req, res, _next) => {
    console.error("Error:", err);
    if (err instanceof ApiError) {
        return res.sendError(err.statusCode, err.message, err.code);
    }
    if (err.name === "ZodError") {
        const issues = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
        return res.sendError(400, `Validation error: ${issues.join(", ")}`, "VALIDATION_ERROR");
    }
    if (err.name === "JsonWebTokenError") {
        return res.sendError(401, "Invalid token", "INVALID_TOKEN");
    }
    if (err.name === "TokenExpiredError") {
        return res.sendError(401, "Token expired", "TOKEN_EXPIRED");
    }
    // Default error
    res.sendError(500, process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error");
};
