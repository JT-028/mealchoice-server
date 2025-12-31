import dotenv from "dotenv";

dotenv.config();

const MEALDB_BASE_URL = "https://www.themealdb.com/api/json/v1/1";
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Placeholder image when no food image is found
const NOT_FOUND_PLACEHOLDER = "https://placehold.co/600x400/1a1a2e/ffffff?text=No+Image+Available";

// Log Unsplash API status
if (UNSPLASH_ACCESS_KEY) {
    console.log("[ImageService] Unsplash API configured");
} else {
    console.log("[ImageService] Unsplash API not configured, using TheMealDB only");
}

/**
 * Extract clean search keywords from a meal name
 * Removes common filler words and keeps main ingredients/cooking methods
 */
const extractSearchKeywords = (mealName) => {
    // Common words to remove that don't help image search
    const stopWords = ['with', 'and', 'the', 'a', 'an', 'in', 'on', 'style', 'homemade', 'fresh', 'special', 'delicious'];

    const words = mealName
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word));

    return words;
};

/**
 * Search for a food image on Unsplash
 * @param {string} query - The meal name to search for
 * @returns {Promise<string|null>} - Image URL or null if not found
 */
const searchUnsplashImage = async (query) => {
    if (!UNSPLASH_ACCESS_KEY) return null;

    try {
        const searchQuery = encodeURIComponent(`${query} food dish meal`);
        const response = await fetch(
            `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=1&orientation=landscape`,
            {
                headers: {
                    'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                console.log(`[Unsplash] Found image for: "${query}"`);
                // Use small size for faster loading
                return data.results[0].urls.regular;
            }
        }

        return null;
    } catch (error) {
        console.error("[Unsplash] Error:", error.message);
        return null;
    }
};

/**
 * Search for a food image on TheMealDB
 * @param {string} query - The meal name to search for
 * @returns {Promise<string|null>} - Image URL or null if not found
 */
export const searchMealDbImage = async (query) => {
    try {
        const keywords = extractSearchKeywords(query);

        // Strategy 1: Search by full meal name
        let searchQuery = encodeURIComponent(query.toLowerCase());
        let response = await fetch(`${MEALDB_BASE_URL}/search.php?s=${searchQuery}`);

        if (response.ok) {
            const data = await response.json();
            if (data.meals && data.meals.length > 0) {
                console.log(`[TheMealDB] Found exact match for: "${query}"`);
                return data.meals[0].strMealThumb;
            }
        }

        // Strategy 2: Search by each keyword and find best match
        for (const keyword of keywords.slice(0, 3)) {
            searchQuery = encodeURIComponent(keyword);
            response = await fetch(`${MEALDB_BASE_URL}/search.php?s=${searchQuery}`);

            if (response.ok) {
                const data = await response.json();
                if (data.meals && data.meals.length > 0) {
                    // Find best match by checking if any meal contains our keywords
                    const matchedMeal = data.meals.find(meal =>
                        keywords.some(kw => meal.strMeal.toLowerCase().includes(kw))
                    ) || data.meals[0]; // Fall back to first result if no keyword match

                    console.log(`[TheMealDB] Found partial match "${matchedMeal.strMeal}" for: "${query}"`);
                    return matchedMeal.strMealThumb;
                }
            }
        }

        // Strategy 3: Search by main ingredient filter
        if (keywords.length > 0) {
            const mainIngredient = encodeURIComponent(keywords[0]);
            response = await fetch(`${MEALDB_BASE_URL}/filter.php?i=${mainIngredient}`);

            if (response.ok) {
                const data = await response.json();
                if (data.meals && data.meals.length > 0) {
                    // Pick a random meal from results to get variety
                    const randomIndex = Math.floor(Math.random() * Math.min(data.meals.length, 5));
                    console.log(`[TheMealDB] Found ingredient-based match for: "${query}"`);
                    return data.meals[randomIndex].strMealThumb;
                }
            }
        }

        console.log(`[TheMealDB] No match found for "${query}"`);
        return null;
    } catch (error) {
        console.error("[TheMealDB] Error:", error.message);
        return null;
    }
};

/**
 * Get placeholder image for when no food image is found
 * @returns {string} - Placeholder image URL
 */
export const getPlaceholderImage = () => {
    return NOT_FOUND_PLACEHOLDER;
};

/**
 * Search for food image with multiple fallbacks
 * Priority: TheMealDB (if good match) -> Unsplash -> Placeholder
 * @param {string} query - The meal name to search for
 * @returns {Promise<string>} - Image URL (real or placeholder)
 */
export const searchFoodImage = async (query) => {
    // First try TheMealDB
    const mealDbImage = await searchMealDbImage(query);
    if (mealDbImage) return mealDbImage;

    // Then try Unsplash for better general food images
    const unsplashImage = await searchUnsplashImage(query);
    if (unsplashImage) return unsplashImage;

    // Finally fall back to placeholder
    return NOT_FOUND_PLACEHOLDER;
};

/**
 * Process AI response and add food images from TheMealDB/Unsplash
 */
export const enrichWithMealDbImages = async (aiResponse, type = "recommendations") => {
    try {
        if (type === "recommendations" && aiResponse.recommendations) {
            for (const rec of aiResponse.recommendations) {
                rec.imageUrl = await searchFoodImage(rec.mealName);
            }
        } else if (type === "mealPlan" && aiResponse.weekPlan) {
            for (const day of Object.keys(aiResponse.weekPlan)) {
                const meals = aiResponse.weekPlan[day];
                for (const mealType of ["breakfast", "lunch", "dinner"]) {
                    if (meals[mealType]?.mealName) {
                        meals[mealType].imageUrl = await searchFoodImage(meals[mealType].mealName);
                    }
                }
            }
        }
        return aiResponse;
    } catch (error) {
        console.error("Error enriching images:", error);
        return aiResponse;
    }
};

export const searchFoodImagesBatch = async (queries) => {
    const results = {};
    for (const query of queries) {
        results[query] = await searchFoodImage(query);
    }
    return results;
};

