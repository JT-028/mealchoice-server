import Budget from "../models/Budget.js";
import Order from "../models/Order.js";

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

// @desc    Get user's spending summary (today and this week)
// @route   GET /api/budget/spending
// @access  Private
export const getSpending = async (req, res) => {
  try {
    // Get or create budget
    let budget = await Budget.findOne({ user: req.user._id });
    if (!budget) {
      budget = await Budget.create({
        user: req.user._id,
        dailyLimit: 500,
        weeklyLimit: 3000,
        alertThreshold: 80
      });
    }

    // Calculate date ranges
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get start of week (Sunday)
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    // Calculate today's spending from completed orders
    const todayOrders = await Order.find({
      buyer: req.user._id,
      status: "completed",
      createdAt: { $gte: startOfToday }
    });
    const todaySpent = todayOrders.reduce((sum, order) => sum + order.total, 0);

    // Calculate this week's spending from completed orders
    const weekOrders = await Order.find({
      buyer: req.user._id,
      status: "completed",
      createdAt: { $gte: startOfWeek }
    });
    const weeklySpent = weekOrders.reduce((sum, order) => sum + order.total, 0);

    // Calculate remaining budgets
    const dailyRemaining = Math.max(0, budget.dailyLimit - todaySpent);
    const weeklyRemaining = Math.max(0, budget.weeklyLimit - weeklySpent);

    res.json({
      success: true,
      spending: {
        todaySpent,
        weeklySpent,
        dailyLimit: budget.dailyLimit,
        weeklyLimit: budget.weeklyLimit,
        dailyRemaining,
        weeklyRemaining,
        alertThreshold: budget.alertThreshold
      }
    });
  } catch (error) {
    console.error("Get spending error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching spending data"
    });
  }
};
