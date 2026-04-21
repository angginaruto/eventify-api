import { createReviewSchema } from "./review.validation.js";
import * as reviewService from "./review.service.js";
export async function createReview(req, res) {
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: "Validation error",
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }
    try {
        const review = await reviewService.createReview(req.params.id, req.user.id, parsed.data);
        res.status(201).json({ message: "Review submitted", data: review });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to submit review";
        const status = message === "Event not found"
            ? 404
            : message.includes("only review completed")
                ? 400
                : message.includes("must have attended")
                    ? 403
                    : message.includes("already reviewed")
                        ? 409
                        : 500;
        res.status(status).json({ message });
    }
}
export async function getEventReviews(req, res) {
    try {
        const result = await reviewService.getEventReviews(req.params.id);
        res.status(200).json({ data: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch reviews";
        const status = message === "Event not found" ? 404 : 500;
        res.status(status).json({ message });
    }
}
