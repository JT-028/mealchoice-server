import OpenAI from "openai";
import dotenv from "dotenv";

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
 * Get personalized meal recommendations from OpenRouter
 * @param {Object} userData - User preferences and health data
 * @param {Array} availableProducts - List of available products for context (optional)
 * @returns {Promise<Object>} - AI response
 */
export const getAIRecommendations = async (userData, availableProducts = []) => {
    try {
        const { preferences, name } = userData;
        
        const systemPrompt = `You are a professional nutritionist and meal planner for "Mealwise", an app that helps users find healthy meals based on their preferences and budget.
        Your goal is to provide personalized meal recommendations based on the user's health data, dietary restrictions, and budget.
        
        Respond ONLY with a valid JSON object in the following format:
        {
            "recommendations": [
                {
                    "mealName": "Name of the meal",
                    "description": "Brief description of why this is good for the user",
                    "calories": number,
                    "macros": { "protein": "g", "carbs": "g", "fats": "g" },
                    "estimatedCost": number,
                    "ingredients": ["ingredient 1", "ingredient 2"],
                    "imageUrl": "https://source.unsplash.com/800x600/?food,dish-name"
                }
            ],
            "nutritionalAdvice": "General advice based on their health data",
            "summary": "Quick summary of how these choices fit their goals"
        }
        
        For imageUrl, replace 'dish-name' with a 2-3 word search term related to the meal name. Example: 'grilled-salmon-salad'. Use commas to separate tags if needed. Avoid using spaces, use hyphens instead.`;

        const userPrompt = `User Name: ${name}
        Health Profile:
        - Height: ${preferences.height}cm
        - Weight: ${preferences.weight}kg
        - Age: ${preferences.age}
        - Sex: ${preferences.sex}
        - Activity Level: ${preferences.activityLevel}
        
        Dietary Preferences:
        - Restrictions: ${preferences.dietaryRestrictions.join(", ") || "None"}
        - Preferred Cuisines: ${preferences.preferredCuisines.join(", ") || "Any"}
        - Preferred Meal Types: ${preferences.preferredMealTypes.join(", ") || "Any"}
        - Avoided Ingredients: ${preferences.avoidedIngredients.join(", ") || "None"}
        
        Budget:
        - Budget per meal: ${preferences.budgetPerMeal || "Not specified"}
        - Price range: ${preferences.prefersPriceRange || "Any"}
        
        Available Products in Market (for reference):
        ${availableProducts.map(p => `- ${p.name} ($${p.price} per ${p.unit})`).join("\n")}
        
        Please provide 3 personalized meal recommendations.`;

        const response = await openai.chat.completions.create({
            model: "xiaomi/mimo-v2-flash:free",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        return JSON.parse(content);
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
        
        const systemPrompt = `You are a professional nutritionist and meal planner for "Mealwise".
        Your goal is to provide a 7-day weekly meal plan (Sunday to Saturday).
        Each day MUST have Breakfast, Lunch, and Dinner.
        
        Respond ONLY with a valid JSON object in the following format:
        {
            "weekPlan": {
                "Sunday": { 
                    "breakfast": { "mealName": "", "calories": 0, "description": "", "imageUrl": "https://source.unsplash.com/800x600/?food,search-term" }, 
                    "lunch": { ... }, 
                    "dinner": { ... } 
                },
                "Monday": { ... },
                "Tuesday": { ... },
                "Wednesday": { ... },
                "Thursday": { ... },
                "Friday": { ... },
                "Saturday": { ... }
            },
            "weeklyMacros": { "avgProtein": "g", "avgCarbs": "g", "avgFats": "g", "avgCalories": 0 },
            "advice": "General advice for the week"
        }
        
        For imageUrl, replace 'search-term' with a relevant food keyword (e.g., 'pancakes', 'salad', 'steak').`;

        const userPrompt = `User Name: ${name}
        Health Profile:
        - Height: ${preferences.height}cm
        - Weight: ${preferences.weight}kg
        - Age: ${preferences.age}
        - Sex: ${preferences.sex}
        - Activity Level: ${preferences.activityLevel}
        
        Dietary Preferences:
        - Restrictions: ${preferences.dietaryRestrictions.join(", ") || "None"}
        - Preferred Cuisines: ${preferences.preferredCuisines.join(", ") || "Any"}
        - Preferred Meal Types: ${preferences.preferredMealTypes.join(", ") || "Any"}
        - Avoided Ingredients: ${preferences.avoidedIngredients.join(", ") || "None"}
        
        Budget:
        - Budget per meal: ${preferences.budgetPerMeal || "Not specified"}
        
        Please provide a complete 7-day meal plan tailored to these goals.`;

        const response = await openai.chat.completions.create({
            model: "xiaomi/mimo-v2-flash:free",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        console.error("OpenRouter AI Meal Plan Error:", error);
        throw new Error("Failed to generate AI meal plan");
    }
};
