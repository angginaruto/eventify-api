// src/middlewares/auth.middleware.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  id: string;
  email: string;
  role: "CUSTOMER" | "ORGANIZER";
}

// extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET as string;

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  // periksa token
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ message: "Unauthorized: no token provided" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized: invalid or expired token" });
  }
}

export function requireRole(...roles: ("CUSTOMER" | "ORGANIZER")[]) {
  // periksa role
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden: insufficient role" });
      return;
    }

    next();
  };
}
