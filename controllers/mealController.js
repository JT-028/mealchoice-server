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
  const { mealName, name, calories, description, macros, estimatedCost, ingredients } = req.body;
  
  // Robust field handling
  const finalMealName = mealName || name;
  
  const meal = new Meal({ 
    user: req.user._id,
    mealName: finalMealName,
    name: finalMealName, // Populate both for compatibility
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

export const deleteMeal = async (req, res) => {
  try {
    const meal = await Meal.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!meal) {
      return res.status(404).json({ success: false, message: 'Meal not found' });
    }
    
    await Meal.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Meal deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
