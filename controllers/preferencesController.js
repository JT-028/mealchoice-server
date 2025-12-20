import User from "../models/User.js";

// @desc    Save onboarding preferences
// @route   POST /api/preferences/onboarding
// @access  Private
export const saveOnboardingPreferences = async (req, res) => {
    try {
        const { health, meal, budget } = req.body;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Update health preferences
        if (health) {
            user.preferences.height = health.height || null;
            user.preferences.weight = health.weight || null;
            user.preferences.age = health.age || null;
            user.preferences.sex = health.sex || null;
            user.preferences.activityLevel = health.activityLevel || null;
            user.preferences.dietaryRestrictions = health.dietaryRestrictions || [];
        }

        // Update meal preferences
        if (meal) {
            user.preferences.preferredMealTypes = meal.preferredMealTypes || [];
            user.preferences.preferredCuisines = meal.preferredCuisines || [];
            user.preferences.preferredIngredients = meal.preferredIngredients || [];
            user.preferences.avoidedIngredients = meal.avoidedIngredients || [];
            user.preferences.calorieMin = meal.calorieMin || 1200;
            user.preferences.calorieMax = meal.calorieMax || 2500;
            user.preferences.maxSodium = meal.maxSodium || 2300;
            user.preferences.maxSugar = meal.maxSugar || 50;
            user.preferences.maxFats = meal.maxFats || 65;
        }

        // Update budget preferences
        if (budget) {
            user.preferences.weeklyBudget = budget.weeklyBudget || null;
            user.preferences.budgetPerMeal = budget.budgetPerMeal || null;
            user.preferences.prefersPriceRange = budget.prefersPriceRange || null;
        }

        // Mark onboarding as complete
        user.hasCompletedOnboarding = true;

        await user.save();

        res.json({
            success: true,
            message: "Onboarding completed successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                hasCompletedOnboarding: user.hasCompletedOnboarding,
                preferences: user.preferences
            }
        });
    } catch (error) {
        console.error("Save onboarding preferences error:", error);
        res.status(500).json({
            success: false,
            message: "Server error saving preferences"
        });
    }
};

// @desc    Get user preferences
// @route   GET /api/preferences
// @access  Private
export const getPreferences = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            preferences: user.preferences
        });
    } catch (error) {
        console.error("Get preferences error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching preferences"
        });
    }
};

// @desc    Update preferences
// @route   PUT /api/preferences
// @access  Private
export const updatePreferences = async (req, res) => {
    try {
        const updates = req.body;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Update only provided fields
        Object.keys(updates).forEach(key => {
            if (user.preferences[key] !== undefined) {
                user.preferences[key] = updates[key];
            }
        });

        await user.save();

        res.json({
            success: true,
            message: "Preferences updated",
            preferences: user.preferences
        });
    } catch (error) {
        console.error("Update preferences error:", error);
        res.status(500).json({
            success: false,
            message: "Server error updating preferences"
        });
    }
};
