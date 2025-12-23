import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getMeals, createMeal, deleteMeal } from '../controllers/mealController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/', getMeals);
router.post('/', createMeal);
router.delete('/:id', deleteMeal);

export default router;
