import mongoose from 'mongoose';

const mealSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  mealName: {
    type: String,
    required: true,
  },
  name: String, // Fallback for compatibility
  description: String,
  calories: {
    type: Number,
    required: true,
  },
  macros: {
    protein: String,
    carbs: String,
    fats: String,
  },
  estimatedCost: Number,
  ingredients: [String],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Meal = mongoose.model('Meal', mealSchema);

export default Meal;
