import OpenAI from "openai";
import dotenv from "dotenv";
import { enrichWithMealDbImages } from "./mealDbService.js";

dotenv.config();

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPEN_ROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173", // Optional, for OpenRouter rankings
        "X-Title": "Mealwise", // Optional, for OpenRouter rankings
    }
});

/**
 * Calculate target daily calories based on user preferences
 * Uses the average of calorieMin and calorieMax, or a sensible default
 */
const calculateDailyCalorieTarget = (preferences) => {
    const min = preferences.calorieMin || 1200;
    const max = preferences.calorieMax || 2500;
    return Math.round((min + max) / 2);
};

/**
 * Get personalized meal recommendations from OpenRouter
 * @param {Object} userData - User preferences and health data
 * @param {Array} availableProducts - List of available products for context (optional)
 * @returns {Promise<Object>} - AI response
 */
export const getAIRecommendations = async (userData, availableProducts = []) => {
    try {
        const { preferences, name } = userData;
        
        // Calculate the user's daily calorie target
        const dailyCalorieTarget = calculateDailyCalorieTarget(preferences);
        const perMealCalories = Math.round(dailyCalorieTarget / 3);
        
        const systemPrompt = `You are a professional nutritionist and meal planner for "Mealwise", an app that helps users find healthy meals based on their preferences and budget.
        Your goal is to provide personalized meal recommendations based on the user's health data, dietary restrictions, and budget.
        
        CRITICAL CALORIE REQUIREMENT:
        - The user's DAILY calorie target is ${dailyCalorieTarget} calories.
        - Each meal recommendation should be approximately ${perMealCalories} calories (assuming 3 meals per day).
        - Ensure the "calories" field in each recommendation reflects this target range (${perMealCalories - 100} to ${perMealCalories + 100} calories per meal).
        - Do NOT recommend meals with only 200-400 calories unless they are snacks - full meals should be ${perMealCalories} calories.
        
        IMPORTANT: For mealName, use SIMPLE, COMMON dish names that are easy to search for images.
        - GOOD: "Grilled Chicken Salad", "Beef Stir Fry", "Salmon with Rice", "Vegetable Pasta", "Oatmeal with Berries"
        - BAD: "Mediterranean Herb-Crusted Free-Range Chicken", "Artisan Fusion Bowl", "Chef's Special Delight"
        Keep meal names to 2-4 words maximum, focusing on the main ingredient and cooking style.
        
        Respond ONLY with a valid JSON object in the following format:
        {
            "recommendations": [
                {
                    "mealName": "Simple meal name (2-4 words)",
                    "description": "Brief description of why this is good for the user",
                    "calories": number,
                    "macros": { "protein": "g", "carbs": "g", "fats": "g" },
                    "nutrition": { "fiber": "g", "sodium": "mg", "sugar": "g" },
                    "estimatedCost": number,
                    "ingredients": ["ingredient 1", "ingredient 2"],
                    "healthBenefits": ["benefit 1", "benefit 2", "benefit 3"],
                    "instructions": ["Step 1: ...", "Step 2: ...", "Step 3: ..."]
                }
            ],
            "nutritionalAdvice": "General advice based on their health data",
            "summary": "Quick summary of how these choices fit their goals"
        }
        
        Do NOT include imageUrl in your response - images will be added automatically.`;

        const userPrompt = `User Name: ${name}
        Health Profile:
        - Height: ${preferences.height}cm
        - Weight: ${preferences.weight}kg
        - Age: ${preferences.age}
        - Sex: ${preferences.sex}
        - Activity Level: ${preferences.activityLevel}
        
        Calorie Goals:
        - Daily Calorie Target: ${dailyCalorieTarget} calories
        - Target per Meal: ~${perMealCalories} calories
        - Calorie Range: ${preferences.calorieMin || 1200} - ${preferences.calorieMax || 2500} calories/day
        
        Dietary Preferences:
        - Restrictions: ${preferences.dietaryRestrictions?.join(", ") || "None"}
        - Preferred Cuisines: ${preferences.preferredCuisines?.join(", ") || "Any"}
        - Preferred Meal Types: ${preferences.preferredMealTypes?.join(", ") || "Any"}
        - Avoided Ingredients: ${preferences.avoidedIngredients?.join(", ") || "None"}
        
        Budget:
        - Budget per meal: ${preferences.budgetPerMeal || "Not specified"}
        - Price range: ${preferences.prefersPriceRange || "Any"}
        
        Available Products in Market (for reference):
        ${availableProducts.map(p => `- ${p.name} ($${p.price} per ${p.unit})`).join("\n")}
        
        Please provide 3 personalized meal recommendations that each contain approximately ${perMealCalories} calories.`;

        const response = await openai.chat.completions.create({
            model: "xiaomi/mimo-v2-flash:free",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        const parsedResponse = JSON.parse(content);
        
        // Enrich with TheMealDB images
        const enrichedResponse = await enrichWithMealDbImages(parsedResponse, "recommendations");
        return enrichedResponse;
    } catch (error) {
        console.error("OpenRouter AI Error:", error);
        throw new Error("Failed to generate AI recommendations");
    }
};

/**
 * Get a weekly meal plan from OpenRouter
 * @param {Object} userData - User preferences and health data
 * @returns {Promise<Object>} - AI response
 */
export const getAIMealPlan = async (userData) => {
    try {
        const { preferences, name } = userData;
        
        // Calculate the user's daily calorie target
        const dailyCalorieTarget = calculateDailyCalorieTarget(preferences);
        // Typical meal distribution: Breakfast 25%, Lunch 35%, Dinner 40%
        const breakfastCalories = Math.round(dailyCalorieTarget * 0.25);
        const lunchCalories = Math.round(dailyCalorieTarget * 0.35);
        const dinnerCalories = Math.round(dailyCalorieTarget * 0.40);
        
        const systemPrompt = `You are a professional nutritionist and meal planner for "Mealwise".
        Your goal is to provide a 7-day weekly meal plan (Sunday to Saturday).
        Each day MUST have Breakfast, Lunch, and Dinner.
        
        CRITICAL CALORIE REQUIREMENT:
        - The user's DAILY calorie target is ${dailyCalorieTarget} calories.
        - Each day's meals MUST add up to approximately ${dailyCalorieTarget} calories total.
        - Target calorie distribution per meal:
          * Breakfast: ~${breakfastCalories} calories (25% of daily)
          * Lunch: ~${lunchCalories} calories (35% of daily)
          * Dinner: ~${dinnerCalories} calories (40% of daily)
        - The "avgCalories" in weeklyMacros should be ${dailyCalorieTarget}.
        - Do NOT create meals with only 200-400 calories - ensure each meal meets its target.
        
        IMPORTANT: For mealName, use SIMPLE, COMMON dish names that are easy to search for images.
        - GOOD: "Scrambled Eggs", "Grilled Chicken", "Pasta Carbonara", "Greek Salad", "Banana Pancakes"
        - BAD: "Chef's Morning Sunrise Platter", "Mediterranean Fusion Delight", "Artisan Protein Bowl"
        Keep meal names to 2-4 words maximum, focusing on the main ingredient and cooking style.
        
        Respond ONLY with a valid JSON object in the following format:
        {
            "weekPlan": {
                "Sunday": { 
                    "breakfast": { "mealName": "Simple name", "calories": ${breakfastCalories}, "description": "" }, 
                    "lunch": { "mealName": "Simple name", "calories": ${lunchCalories}, "description": "" }, 
                    "dinner": { "mealName": "Simple name", "calories": ${dinnerCalories}, "description": "" } 
                },
                "Monday": { ... },
                "Tuesday": { ... },
                "Wednesday": { ... },
                "Thursday": { ... },
                "Friday": { ... },
                "Saturday": { ... }
            },
            "weeklyMacros": { "avgProtein": "g", "avgCarbs": "g", "avgFats": "g", "avgCalories": ${dailyCalorieTarget} },
            "advice": "General advice for the week"
        }
        
        Do NOT include imageUrl in your response - images will be added automatically.`;

        const userPrompt = `User Name: ${name}
        Health Profile:
        - Height: ${preferences.height}cm
        - Weight: ${preferences.weight}kg
        - Age: ${preferences.age}
        - Sex: ${preferences.sex}
        - Activity Level: ${preferences.activityLevel}
        
        Calorie Goals:
        - Daily Calorie Target: ${dailyCalorieTarget} calories
        - Breakfast Target: ~${breakfastCalories} calories
        - Lunch Target: ~${lunchCalories} calories
        - Dinner Target: ~${dinnerCalories} calories
        - Calorie Range: ${preferences.calorieMin || 1200} - ${preferences.calorieMax || 2500} calories/day
        
        Dietary Preferences:
        - Restrictions: ${preferences.dietaryRestrictions?.join(", ") || "None"}
        - Preferred Cuisines: ${preferences.preferredCuisines?.join(", ") || "Any"}
        - Preferred Meal Types: ${preferences.preferredMealTypes?.join(", ") || "Any"}
        - Avoided Ingredients: ${preferences.avoidedIngredients?.join(", ") || "None"}
        
        Budget:
        - Budget per meal: ${preferences.budgetPerMeal || "Not specified"}
        
        Please provide a complete 7-day meal plan where each day totals approximately ${dailyCalorieTarget} calories.`;

        const response = await openai.chat.completions.create({
            model: "xiaomi/mimo-v2-flash:free",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        const parsedResponse = JSON.parse(content);
        
        // Enrich with TheMealDB images
        const enrichedResponse = await enrichWithMealDbImages(parsedResponse, "mealPlan");
        return enrichedResponse;
    } catch (error) {
        console.error("OpenRouter AI Meal Plan Error:", error);
        throw new Error("Failed to generate AI meal plan");
    }
};
