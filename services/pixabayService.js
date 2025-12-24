import dotenv from "dotenv";

dotenv.config();

const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const PIXABAY_BASE_URL = "https://pixabay.com/api";

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
    
    // Return first 3 meaningful words for focused search
    return words.slice(0, 3).join(' ');
};

/**
 * Build Pixabay API URL with optimized parameters
 */
const buildPixabayUrl = (searchQuery, options = {}) => {
    const params = new URLSearchParams({
        key: PIXABAY_API_KEY,
        q: searchQuery,
        image_type: 'photo',           // Only real photos, no illustrations/vectors
        orientation: 'horizontal',      // Better for cards/thumbnails
        category: options.category || 'food',
        safesearch: 'true',            // Family-friendly images only
        order: 'popular',              // Most popular images first (usually higher quality)
        per_page: options.perPage || 15,
        min_width: 400,                // Ensure decent resolution
        min_height: 300,
        lang: 'en',                    // Search in English
        ...(options.editorsChoice && { editors_choice: 'true' }) // High-quality curated images
    });
    
    return `${PIXABAY_BASE_URL}/?${params.toString()}`;
};

/**
 * Search for a food image on Pixabay with improved accuracy
 */
export const searchFoodImage = async (query) => {
    try {
        if (!PIXABAY_API_KEY) {
            console.warn("PIXABAY_API_KEY not configured");
            return null;
        }

        // Extract clean keywords for better search results
        const cleanKeywords = extractSearchKeywords(query);
        
        // Strategy 1: Search with "food" suffix for context
        let searchQuery = `${cleanKeywords} food dish`;
        console.log(`Pixabay search: "${searchQuery}"`);

        let response = await fetch(buildPixabayUrl(searchQuery, { editorsChoice: false }));
        
        if (!response.ok) {
            console.error(`Pixabay error: ${response.status}`);
            return null;
        }

        let data = await response.json();

        // Strategy 2: If no results, try without "dish" and with broader category
        if (!data.hits || data.hits.length === 0) {
            searchQuery = `${cleanKeywords} meal`;
            console.log(`Pixabay retry search: "${searchQuery}"`);
            
            response = await fetch(buildPixabayUrl(searchQuery, { category: '' })); // Remove category filter
            
            if (response.ok) {
                data = await response.json();
            }
        }

        // Strategy 3: Last resort - just use the main keyword
        if (!data.hits || data.hits.length === 0) {
            const mainKeyword = cleanKeywords.split(' ')[0];
            searchQuery = `${mainKeyword} food`;
            console.log(`Pixabay final search: "${searchQuery}"`);
            
            response = await fetch(buildPixabayUrl(searchQuery, { category: 'food' }));
            
            if (response.ok) {
                data = await response.json();
            }
        }

        if (data.hits && data.hits.length > 0) {
            // Pick from top 5 results randomly to add variety
            const topResults = data.hits.slice(0, Math.min(5, data.hits.length));
            const randomIndex = Math.floor(Math.random() * topResults.length);
            const selectedImage = topResults[randomIndex];
            
            // Prefer larger format URL if available
            return selectedImage.largeImageURL || selectedImage.webformatURL;
        }

        console.warn(`No Pixabay images found for: "${query}"`);
        return null;
    } catch (error) {
        console.error("Pixabay error:", error.message);
        return null;
    }
};

/**
 * Process AI response and add food images
 */
export const enrichWithPixabayImages = async (aiResponse, type = "recommendations") => {
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
