import User from "../models/User.js";
import Product from "../models/Product.js";
import { getAIRecommendations } from "../services/openRouterService.js";

/**
 * @desc    Get personalized meal recommendations
 * @route   GET /api/recommendations
 * @access  Private
 */
export const getRecommendations = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!user.hasCompletedOnboarding) {
            return res.status(400).json({
                success: false,
                message: "Please complete onboarding to get personalized recommendations"
            });
        }

        // Fetch some products for context (limit to 20 for prompt size)
        const availableProducts = await Product.find({ isAvailable: true })
            .limit(20)
            .select("name price unit category");

        const recommendations = await getAIRecommendations(user, availableProducts);

        res.json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        console.error("Get recommendations error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Server error fetching recommendations"
        });
    }
};
