import express from "express";
import { getBudget, updateBudget } from "../controllers/budgetController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes are protected
router.get("/", protect, getBudget);
router.put("/", protect, updateBudget);

export default router;
