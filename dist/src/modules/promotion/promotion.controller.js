import { createPromotionSchema } from "./promotion.validation.js";
import * as promotionService from "./promotion.service.js";
export async function createPromotion(req, res) {
    const parsed = createPromotionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: "Validation error",
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }
    try {
        const promotion = await promotionService.createPromotion(req.params.id, req.user.id, parsed.data);
        res.status(201).json({ message: "Promotion created", data: promotion });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create promotion";
        const status = message === "Event not found"
            ? 404
            : message === "Forbidden"
                ? 403
                : message === "Promotion code already exists"
                    ? 409
                    : 400;
        res.status(status).json({ message });
    }
}
export async function getEventPromotions(req, res) {
    try {
        const promotions = await promotionService.getEventPromotions(req.params.id, req.user.id);
        res.status(200).json({ data: promotions });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch promotions";
        const status = message === "Event not found" ? 404 : message === "Forbidden" ? 403 : 500;
        res.status(status).json({ message });
    }
}
export async function deletePromotion(req, res) {
    try {
        await promotionService.deletePromotion(req.params.promotionId, req.user.id);
        res.status(200).json({ message: "Promotion deleted" });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete promotion";
        const status = message === "Promotion not found"
            ? 404
            : message === "Forbidden"
                ? 403
                : message.includes("already been used")
                    ? 400
                    : 500;
        res.status(status).json({ message });
    }
}
export async function validatePromoCode(req, res) {
    const { code, eventId } = req.body;
    if (!code || !eventId) {
        res.status(400).json({ message: "code and eventId are required" });
        return;
    }
    try {
        const promotion = await promotionService.validatePromoCode(code, eventId);
        res.status(200).json({ data: promotion });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Invalid promotion code";
        res.status(400).json({ message });
    }
}
