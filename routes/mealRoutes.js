import express from 'express';
import { getMeals, createMeal } from '../controllers/mealController.js';

const router = express.Router();

router.get('/', getMeals);
router.post('/', createMeal);

export default router;
