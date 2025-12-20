import express from "express";
import {
    saveOnboardingPreferences,
    getPreferences,
    updatePreferences
} from "../controllers/preferencesController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

router.post("/onboarding", saveOnboardingPreferences);
router.get("/", getPreferences);
router.put("/", updatePreferences);

export default router;
