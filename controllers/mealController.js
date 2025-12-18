import Meal from '../models/Meal.js';

export const getMeals = async (req, res) => {
  try {
    const meals = await Meal.find().sort({ createdAt: -1 });
    res.json(meals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createMeal = async (req, res) => {
  const { name, calories } = req.body;
  const meal = new Meal({ name, calories });

  try {
    const newMeal = await meal.save();
    res.status(201).json(newMeal);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
