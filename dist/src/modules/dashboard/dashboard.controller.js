import * as dashboardService from "./dashboard.service.js";
export async function getDashboardStats(req, res) {
    const range = req.query.range || "month";
    if (!["day", "month", "year"].includes(range)) {
        res
            .status(400)
            .json({ message: "Range must be 'day', 'month', or 'year'" });
        return;
    }
    try {
        const stats = await dashboardService.getDashboardStats(req.user.id, range);
        res.status(200).json({ data: stats });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
}
export async function getOrganizerEventStats(req, res) {
    try {
        const events = await dashboardService.getOrganizerEventStats(req.user.id);
        res.status(200).json({ data: events });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch event stats" });
    }
}
