import dotenv from "dotenv";

dotenv.config();

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PEXELS_BASE_URL = "https://api.pexels.com/v1";

/**
 * Search for a food image on Pexels
 * @param {string} query - Search term (e.g., "grilled salmon", "pancakes")
 * @returns {Promise<string>} - Image URL or fallback placeholder
 */
export const searchFoodImage = async (query) => {
    try {
        if (!PEXELS_API_KEY) {
            console.warn("PEXELS_API_KEY not configured, using fallback image");
            return getFallbackImage(query);
        }

        const searchQuery = `${query} food dish`;
        const response = await fetch(
            `${PEXELS_BASE_URL}/search?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=landscape`,
            {
                headers: {
                    Authorization: PEXELS_API_KEY,
                },
            }
        );

        if (!response.ok) {
            console.error(`Pexels API error: ${response.status}`);
            return getFallbackImage(query);
        }

        const data = await response.json();

        if (data.photos && data.photos.length > 0) {
            // Return medium size image (good balance of quality and load time)
            return data.photos[0].src.medium;
        }

        return getFallbackImage(query);
    } catch (error) {
        console.error("Error fetching Pexels image:", error);
        return getFallbackImage(query);
    }
};

/**
 * Get multiple food images in batch
 * @param {Array<string>} queries - Array of search terms
 * @returns {Promise<Object>} - Map of query to image URL
 */
export const searchFoodImagesBatch = async (queries) => {
    const results = {};
    
    // Process in parallel with a small concurrency limit
    const batchSize = 5;
    for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        const promises = batch.map(async (query) => {
            const imageUrl = await searchFoodImage(query);
            return { query, imageUrl };
        });
        
        const batchResults = await Promise.all(promises);
        batchResults.forEach(({ query, imageUrl }) => {
            results[query] = imageUrl;
        });
    }
    
    return results;
};

/**
 * Generate a fallback placeholder image URL
 * @param {string} query - Search term for the placeholder
 * @returns {string} - Placeholder image URL
 */
const getFallbackImage = (query) => {
    // Use Lorem Picsum as a reliable fallback
    // Add a seed based on query for consistent images
    const seed = query.toLowerCase().replace(/\s+/g, "-").substring(0, 20);
    return `https://picsum.photos/seed/${seed}/800/600`;
};

/**
 * Process AI response and replace placeholder URLs with real Pexels images
 * @param {Object} aiResponse - The AI response object
 * @param {string} type - 'recommendations' or 'mealPlan'
 * @returns {Promise<Object>} - Updated response with real image URLs
 */
export const enrichWithPexelsImages = async (aiResponse, type = "recommendations") => {
    try {
        if (type === "recommendations" && aiResponse.recommendations) {
            // Handle recommendations format
            const imagePromises = aiResponse.recommendations.map(async (rec) => {
                const imageUrl = await searchFoodImage(rec.mealName);
                return { ...rec, imageUrl };
            });
            
            aiResponse.recommendations = await Promise.all(imagePromises);
        } else if (type === "mealPlan" && aiResponse.weekPlan) {
            // Handle meal plan format
            const days = Object.keys(aiResponse.weekPlan);
            
            for (const day of days) {
                const meals = aiResponse.weekPlan[day];
                for (const mealType of ["breakfast", "lunch", "dinner"]) {
                    if (meals[mealType] && meals[mealType].mealName) {
                        meals[mealType].imageUrl = await searchFoodImage(meals[mealType].mealName);
                    }
                }
            }
        }
        
        return aiResponse;
    } catch (error) {
        console.error("Error enriching with Pexels images:", error);
        return aiResponse; // Return original response if enrichment fails
    }
};
