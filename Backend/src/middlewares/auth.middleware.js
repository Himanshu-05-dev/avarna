import jwt from "jsonwebtoken";
import blacklistModel from "../models/blacklist.model.js";

export const identifyUser = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: "Authentication required. Please log in.", errorCode: "NO_TOKEN" });
  }
  try {
    // Check if this token was invalidated by logout
    const isBlacklisted = await blacklistModel.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({ error: "Session expired. Please log in again.", errorCode: "TOKEN_BLACKLISTED" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again.", errorCode: "INVALID_TOKEN" });
  }
};
