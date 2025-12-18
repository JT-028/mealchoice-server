import Budget from "../models/Budget.js";

// @desc    Get user's budget settings
// @route   GET /api/budget
// @access  Private
export const getBudget = async (req, res) => {
  try {
    let budget = await Budget.findOne({ user: req.user._id });

    // Create default budget if none exists
    if (!budget) {
      budget = await Budget.create({
        user: req.user._id,
        dailyLimit: 500,
        weeklyLimit: 3000,
        alertThreshold: 80
      });
    }

    res.json({
      success: true,
      budget
    });
  } catch (error) {
    console.error("Get budget error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching budget"
    });
  }
};

// @desc    Update budget settings
// @route   PUT /api/budget
// @access  Private
export const updateBudget = async (req, res) => {
  try {
    const { dailyLimit, weeklyLimit, alertThreshold } = req.body;

    let budget = await Budget.findOne({ user: req.user._id });

    if (!budget) {
      budget = new Budget({ user: req.user._id });
    }

    if (dailyLimit !== undefined) budget.dailyLimit = dailyLimit;
    if (weeklyLimit !== undefined) budget.weeklyLimit = weeklyLimit;
    if (alertThreshold !== undefined) budget.alertThreshold = alertThreshold;

    await budget.save();

    res.json({
      success: true,
      message: "Budget updated successfully",
      budget
    });
  } catch (error) {
    console.error("Update budget error:", error);
    
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0]
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error updating budget"
    });
  }
};
