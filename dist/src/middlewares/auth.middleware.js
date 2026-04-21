import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
export function verifyToken(req, res, next) {
    const token = req.cookies?.token;
    if (!token) {
        res.status(401).json({ message: "Unauthorized: no token provided" });
        return;
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ message: "Unauthorized: invalid or expired token" });
    }
}
export function requireRole(...roles) {
    return (req, res, next) => {
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
