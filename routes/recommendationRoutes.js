import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getRecommendations } from "../controllers/recommendationController.js";

const router = express.Router();

// All routes are protected
router.use(protect);

router.get("/", getRecommendations);

export default router;
