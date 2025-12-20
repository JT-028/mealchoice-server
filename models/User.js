import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    minlength: [2, "Name must be at least 2 characters"],
    maxlength: [50, "Name cannot exceed 50 characters"]
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"]
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false // Don't include password in queries by default
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  role: {
    type: String,
    enum: ["customer", "seller", "admin"],
    default: "customer"
  },
  // For sellers
  marketLocation: {
    type: String,
    enum: ["San Nicolas Market", "Pampanga Market", null],
    default: null
  },
  storeHours: {
    open: { type: String, default: "06:00" },
    close: { type: String, default: "18:00" }
  },
  paymentQR: {
    type: String,
    default: null
  },
  // Notification preferences
  notifyNewOrders: {
    type: Boolean,
    default: true
  },
  notifyLowStock: {
    type: Boolean,
    default: true
  },
  // Theme preference
  theme: {
    type: String,
    enum: ["light", "dark", "system"],
    default: "system"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Seller verification (admin approval)
  isVerified: {
    type: Boolean,
    default: true // Customers are auto-verified, sellers will be set to false
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  // Email verification
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  // Password change required (for temp passwords)
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  // Onboarding
  hasCompletedOnboarding: {
    type: Boolean,
    default: false
  },
  // Customer preferences (set during onboarding)
  preferences: {
    // Health preferences
    height: { type: Number, default: null }, // cm
    weight: { type: Number, default: null }, // kg
    age: { type: Number, default: null },
    sex: { type: String, enum: ["male", "female", "other", null], default: null },
    activityLevel: {
      type: String,
      enum: ["sedentary", "light", "moderate", "active", "very_active", null],
      default: null
    },
    dietaryRestrictions: [{ type: String }], // e.g., ["vegetarian", "gluten-free"]

    // Meal preferences
    preferredMealTypes: [{ type: String }], // e.g., ["breakfast", "lunch", "dinner"]
    preferredCuisines: [{ type: String }], // e.g., ["filipino", "asian", "western"]
    preferredIngredients: [{ type: String }],
    avoidedIngredients: [{ type: String }],
    calorieMin: { type: Number, default: 1200 },
    calorieMax: { type: Number, default: 2500 },
    maxSodium: { type: Number, default: 2300 }, // mg
    maxSugar: { type: Number, default: 50 }, // g
    maxFats: { type: Number, default: 65 }, // g

    // Budget preferences
    weeklyBudget: { type: Number, default: null },
    budgetPerMeal: { type: Number, default: null },
    prefersPriceRange: {
      type: String,
      enum: ["budget", "moderate", "premium", null],
      default: null
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model("User", userSchema);

export default User;
