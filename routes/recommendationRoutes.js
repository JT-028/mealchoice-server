import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getRecommendations, getMealPlan, getRecommendationsByCategory } from "../controllers/recommendationController.js";

const router = express.Router();

// All routes are protected
router.use(protect);

router.get("/", getRecommendations);
router.get("/generate/:mealType", getRecommendationsByCategory);
router.get("/meal-plan", getMealPlan);

export default router;

