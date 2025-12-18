import express from "express";
import { register, login, getProfile, verifyEmail, changePassword } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.get("/verify/:token", verifyEmail);

// Protected routes
router.get("/profile", protect, getProfile);
router.put("/change-password", protect, changePassword);

export default router;
