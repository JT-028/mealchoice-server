import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getMeals, createMeal } from '../controllers/mealController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/', getMeals);
router.post('/', createMeal);

export default router;
