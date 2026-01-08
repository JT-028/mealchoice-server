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
  imageUrl: String,
  instructions: [String],
  nutrition: {
    fiber: String,
    sugar: String,
    sodium: String,
  },
  healthBenefits: [String],
  scheduledDate: {
    type: Date,
    default: null,
  },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snacks', null],
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Meal = mongoose.model('Meal', mealSchema);

export default Meal;
