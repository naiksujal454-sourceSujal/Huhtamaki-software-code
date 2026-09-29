import { getApiUrl } from './apiConfig';

export interface CreatedRecipe {
  id: string;
  name: string;
  type: string;
  image: string;
  rawImage?: string;
  processedImage?: string;
  targetCode?: string;
  description?: string;
  createdAt?: string | null;
}

export const DEFAULT_PRESETS: CreatedRecipe[] = [
  {
    id: 'recipe1',
    name: 'recipe1',
    type: 'Preset',
    image: getApiUrl('/api/recipes/image/recipe1.png'),
    rawImage: getApiUrl('/api/recipes/image/recipe1.png'),
    processedImage: getApiUrl('/api/recipes/processed/recipe1.png'),
    targetCode: '8901030866784',
    description: 'Standard 1D Barcode Label Preset 1',
  },
  {
    id: 'recipe2',
    name: 'recipe2',
    type: 'Preset',
    image: getApiUrl('/api/recipes/image/recipe2.png'),
    rawImage: getApiUrl('/api/recipes/image/recipe2.png'),
    processedImage: getApiUrl('/api/recipes/processed/recipe2.png'),
    targetCode: '8901088719841',
    description: 'High-density 1D Barcode Label Preset 2',
  },
  {
    id: 'recipe3',
    name: 'recipe3',
    type: 'Preset',
    image: getApiUrl('/api/recipes/image/recipe3.png'),
    rawImage: getApiUrl('/api/recipes/image/recipe3.png'),
    processedImage: getApiUrl('/api/recipes/processed/recipe3.png'),
    targetCode: '5011987214491',
    description: 'Standard Packaging Label Preset 3',
  },
];

const CACHE_KEY_ALL = 'huhtamaki_all_recipes_cache';
const CACHE_KEY_CUSTOM = 'pixtron_custom_recipes';

// In-memory cache holding recipes across component mounts/unmounts
let memoryRecipes: CreatedRecipe[] | null = null;
const subscribers = new Set<(recipes: CreatedRecipe[]) => void>();

export function subscribeToRecipes(callback: (recipes: CreatedRecipe[]) => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function notifySubscribers() {
  if (memoryRecipes) {
    const copy = [...memoryRecipes];
    subscribers.forEach((cb) => {
      try {
        cb(copy);
      } catch (err) {
        console.error('Error notifying recipe subscriber:', err);
      }
    });
  }
}

/**
 * Preloads recipe image into browser memory so preview renders instantly without delay.
 */
export function prewarmRecipeImage(imageUrl?: string) {
  if (!imageUrl || imageUrl.startsWith('data:')) return;
  try {
    const img = new Image();
    img.src = imageUrl;
  } catch {
    // Ignore prewarm errors
  }
}

export function prewarmRecipeImages(recipes: CreatedRecipe[]) {
  recipes.forEach((r) => {
    if (r.image) prewarmRecipeImage(r.image);
    if (r.rawImage && r.rawImage !== r.image) prewarmRecipeImage(r.rawImage);
  });
}

/**
 * Synchronously retrieves all recipes with ZERO latency (0ms).
 * Combines in-memory cache, persistent localStorage, and default presets.
 */
export function getCachedRecipes(): CreatedRecipe[] {
  if (memoryRecipes && memoryRecipes.length > 0) {
    return [...memoryRecipes];
  }

  // 1. Try reading from primary local storage cache
  let loadedList: CreatedRecipe[] = [];
  try {
    const cachedStr = localStorage.getItem(CACHE_KEY_ALL);
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        loadedList = parsed;
      }
    }
  } catch (e) {
    console.warn('Failed reading recipes cache from localStorage:', e);
  }

  // 2. Also check legacy custom recipes key
  try {
    const legacyStr = localStorage.getItem(CACHE_KEY_CUSTOM);
    if (legacyStr) {
      const parsedCustom = JSON.parse(legacyStr);
      if (Array.isArray(parsedCustom)) {
        const existingIds = new Set(loadedList.map((r) => r.id));
        parsedCustom.forEach((item: CreatedRecipe) => {
          if (!existingIds.has(item.id)) {
            loadedList.push(item);
            existingIds.add(item.id);
          }
        });
      }
    }
  } catch (e) {
    console.warn('Failed reading custom recipes from legacy key:', e);
  }

  // 3. Ensure default presets (1, 2, 3) are present
  const existingIds = new Set(loadedList.map((r) => r.id));
  DEFAULT_PRESETS.forEach((preset) => {
    if (!existingIds.has(preset.id)) {
      loadedList.push(preset);
      existingIds.add(preset.id);
    }
  });

  if (loadedList.length === 0) {
    loadedList = [...DEFAULT_PRESETS];
  }

  memoryRecipes = loadedList;
  prewarmRecipeImages(loadedList);
  return [...loadedList];
}

/**
 * Saves or updates a recipe immediately in both memory and localStorage.
 */
export function saveRecipeToStore(recipe: CreatedRecipe) {
  const current = getCachedRecipes();
  const index = current.findIndex((r) => r.id === recipe.id);
  let updated: CreatedRecipe[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...current[index], ...recipe };
  } else {
    // Put newly created recipe at the beginning for immediate visibility
    updated = [recipe, ...current];
  }

  memoryRecipes = updated;

  try {
    localStorage.setItem(CACHE_KEY_ALL, JSON.stringify(updated));
    // Also update custom recipes list for backward compatibility
    const customOnly = updated.filter((r) => !['recipe1', 'recipe2', 'recipe3'].includes(r.id));
    localStorage.setItem(CACHE_KEY_CUSTOM, JSON.stringify(customOnly));
  } catch (e) {
    console.warn('Failed saving recipes to localStorage:', e);
  }

  prewarmRecipeImage(recipe.image);
  if (recipe.rawImage) prewarmRecipeImage(recipe.rawImage);
  notifySubscribers();
}

/**
 * Removes a recipe immediately from both memory and localStorage.
 */
export function deleteRecipeFromStore(recipeId: string) {
  const current = getCachedRecipes();
  const updated = current.filter((r) => r.id !== recipeId);
  memoryRecipes = updated;

  try {
    localStorage.setItem(CACHE_KEY_ALL, JSON.stringify(updated));
    const customOnly = updated.filter((r) => !['recipe1', 'recipe2', 'recipe3'].includes(r.id));
    localStorage.setItem(CACHE_KEY_CUSTOM, JSON.stringify(customOnly));
  } catch (e) {
    console.warn('Failed updating localStorage on recipe delete:', e);
  }

  notifySubscribers();
}

let syncPromise: Promise<CreatedRecipe[]> | null = null;

/**
 * Background synchronizer with backend.
 * Stale-while-revalidate pattern: keeps UI instant while quietly syncing changes.
 */
export async function syncRecipesWithBackend(force: boolean = false): Promise<CreatedRecipe[]> {
  if (syncPromise && !force) {
    return syncPromise;
  }

  syncPromise = (async () => {
    try {
      const resp = await fetch(getApiUrl('/api/recipes'), {
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (resp.ok) {
        const backendData: CreatedRecipe[] = await resp.json();
        if (Array.isArray(backendData) && backendData.length > 0) {
          // Merge backend recipes with any local custom recipes
          const backendIds = new Set(backendData.map((r) => r.id));
          const current = memoryRecipes || getCachedRecipes();
          const unsyncedLocals = current.filter((r) => !backendIds.has(r.id) && !['recipe1', 'recipe2', 'recipe3'].includes(r.id));

          const merged = [...backendData, ...unsyncedLocals];

          // Ensure default recipes exist
          const mergedIds = new Set(merged.map((r) => r.id));
          DEFAULT_PRESETS.forEach((dp) => {
            if (!mergedIds.has(dp.id)) {
              merged.push(dp);
            }
          });

          memoryRecipes = merged;
          try {
            localStorage.setItem(CACHE_KEY_ALL, JSON.stringify(merged));
            const customOnly = merged.filter((r) => !['recipe1', 'recipe2', 'recipe3'].includes(r.id));
            localStorage.setItem(CACHE_KEY_CUSTOM, JSON.stringify(customOnly));
          } catch (e) {
            console.warn('Failed saving synced recipes to localStorage:', e);
          }

          prewarmRecipeImages(merged);
          notifySubscribers();
          return merged;
        }
      }
    } catch (err) {
      console.warn('Could not sync recipes from backend, using instant cache:', err);
    } finally {
      syncPromise = null;
    }

    return getCachedRecipes();
  })();

  return syncPromise;
}

/**
 * Called on application startup to warm up cache and images ahead of time.
 */
export function preloadRecipes() {
  getCachedRecipes();
  syncRecipesWithBackend();
}
