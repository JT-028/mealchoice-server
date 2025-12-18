import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  dailyLimit: {
    type: Number,
    default: 500,
    min: [0, "Daily limit cannot be negative"]
  },
  weeklyLimit: {
    type: Number,
    default: 3000,
    min: [0, "Weekly limit cannot be negative"]
  },
  alertThreshold: {
    type: Number,
    default: 80, // Alert when 80% of budget is used
    min: [0, "Threshold cannot be negative"],
    max: [100, "Threshold cannot exceed 100"]
  },
  currency: {
    type: String,
    default: "PHP"
  }
}, {
  timestamps: true
});

const Budget = mongoose.model("Budget", budgetSchema);

export default Budget;
