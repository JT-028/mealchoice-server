import Meal from '../models/Meal.js';

export const getMeals = async (req, res) => {
  try {
    const meals = await Meal.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: meals
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createMeal = async (req, res) => {
  const { mealName, calories, description, macros, estimatedCost, ingredients } = req.body;
  
  const meal = new Meal({ 
    user: req.user._id,
    mealName, 
    calories,
    description,
    macros,
    estimatedCost,
    ingredients
  });

  try {
    const newMeal = await meal.save();
    res.status(201).json({
      success: true,
      data: newMeal
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
