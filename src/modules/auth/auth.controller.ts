// src/modules/auth/auth.controller.ts
import type { Request, Response } from "express";
import { registerSchema, loginSchema } from "./auth.validation.js";
import * as authService from "./auth.service.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const { token, user } = await authService.register(parsed.data);
    res.cookie("token", token, COOKIE_OPTIONS);
    // kirim token di body juga untuk fallback Authorization header
    res.status(201).json({ message: "Register successful", data: user, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Register failed";
    const status = message === "Email already registered" ? 409 : 400;
    res.status(status).json({ message });
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const { token, user } = await authService.login(parsed.data);
    res.cookie("token", token, COOKIE_OPTIONS);
    // kirim token di body juga untuk fallback Authorization header
    res.status(200).json({ message: "Login successful", data: user, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    res.status(401).json({ message });
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  res.status(200).json({ message: "Logout successful" });
}

export async function getMe(req: Request, res: Response) {
  try {
    const user = await authService.getMe(req.user!.id);
    res.status(200).json({ data: user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get user";
    res.status(404).json({ message });
  }
}
