// src/modules/auth/auth.router.ts
import { Router } from "express";
import { verifyToken } from "../../middlewares/auth.middleware.js";
import * as authController from "./auth.controller.js";
const router = Router();
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", verifyToken, authController.getMe);
export default router;
