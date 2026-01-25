// Google Translate API service for book translation
// Uses the free Google Translate unofficial API - OPTIMIZED with batch processing

const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';

// Cache translations to avoid repeated API calls
const translationCache = new Map<string, string>();

export type TranslationLanguage = 'uk' | 'ru' | 'en' | 'de' | 'fr' | 'es' | 'pl';

export const TRANSLATION_LANGUAGES: { code: TranslationLanguage; name: string; flag: string }[] = [
    { code: 'uk', name: 'Українська', flag: '🇺🇦' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱' },
];

// Unique separator that won't appear in normal text
const BATCH_SEPARATOR = '\n|||SPLIT|||\n';

/**
 * Translate a batch of texts in one request
 */
async function translateBatch(
    texts: string[],
    targetLang: TranslationLanguage,
    sourceLang: string = 'auto'
): Promise<string[]> {
    // Check cache for all texts first
    const results: (string | null)[] = texts.map(text => {
        const cacheKey = `${sourceLang}:${targetLang}:${text}`;
        return translationCache.get(cacheKey) || null;
    });

    // Find which texts need translation
    const needsTranslation = texts.filter((_, i) => results[i] === null);

    if (needsTranslation.length === 0) {
        return results as string[];
    }

    // Join texts with separator for batch translation
    const combinedText = needsTranslation.join(BATCH_SEPARATOR);

    try {
        const params = new URLSearchParams({
            client: 'gtx',
            sl: sourceLang,
            tl: targetLang,
            dt: 't',
            q: combinedText,
        });

        const response = await fetch(`${TRANSLATE_URL}?${params}`);

        if (!response.ok) {
            throw new Error(`Translation failed: ${response.status}`);
        }

        const data = await response.json();

        // Parse Google Translate response
        let translatedText = '';
        if (Array.isArray(data) && Array.isArray(data[0])) {
            for (const sentence of data[0]) {
                if (sentence && sentence[0]) {
                    translatedText += sentence[0];
                }
            }
        }

        // Split back into individual translations
        const translatedParts = translatedText.split(/\|\|\|SPLIT\|\|\||\|\|\| SPLIT \|\|\|/i);

        // Map translated parts back and cache them
        let translatedIndex = 0;
        for (let i = 0; i < texts.length; i++) {
            if (results[i] === null) {
                const translated = translatedParts[translatedIndex]?.trim() || texts[i];
                results[i] = translated;

                // Cache the result
                const cacheKey = `${sourceLang}:${targetLang}:${texts[i]}`;
                translationCache.set(cacheKey, translated);

                translatedIndex++;
            }
        }

        return results as string[];
    } catch (error) {
        console.error('Batch translation error:', error);
        // Return original texts on error
        return texts;
    }
}

/**
 * Translate text using Google Translate API
 */
export async function translateText(
    text: string,
    targetLang: TranslationLanguage,
    sourceLang: string = 'auto'
): Promise<string> {
    if (!text.trim()) return text;

    const results = await translateBatch([text], targetLang, sourceLang);
    return results[0];
}

/**
 * Translate multiple paragraphs with progress callback - OPTIMIZED
 * Uses batch processing (10 paragraphs per request) + parallel requests
 */
export async function translateParagraphs(
    paragraphs: string[],
    targetLang: TranslationLanguage,
    onProgress?: (current: number, total: number) => void
): Promise<string[]> {
    const results: string[] = new Array(paragraphs.length);
    const total = paragraphs.length;
    const BATCH_SIZE = 10; // Translate 10 paragraphs per request
    const PARALLEL_REQUESTS = 3; // Send 3 requests in parallel

    // Create batches
    const batches: { startIndex: number; texts: string[] }[] = [];
    for (let i = 0; i < paragraphs.length; i += BATCH_SIZE) {
        batches.push({
            startIndex: i,
            texts: paragraphs.slice(i, i + BATCH_SIZE)
        });
    }

    let completed = 0;

    // Process batches in parallel groups
    for (let i = 0; i < batches.length; i += PARALLEL_REQUESTS) {
        const parallelBatches = batches.slice(i, i + PARALLEL_REQUESTS);

        const batchPromises = parallelBatches.map(async (batch) => {
            const translated = await translateBatch(batch.texts, targetLang);

            // Store results
            for (let j = 0; j < translated.length; j++) {
                results[batch.startIndex + j] = translated[j];
            }

            completed += batch.texts.length;
            onProgress?.(Math.min(completed, total), total);
        });

        await Promise.all(batchPromises);
    }

    return results;
}

/**
 * Detect language of text
 */
export async function detectLanguage(text: string): Promise<string> {
    try {
        const params = new URLSearchParams({
            client: 'gtx',
            sl: 'auto',
            tl: 'en',
            dt: 't',
            q: text.slice(0, 200),
        });

        const response = await fetch(`${TRANSLATE_URL}?${params}`);
        const data = await response.json();

        if (data && data[2]) {
            return data[2];
        }

        return 'unknown';
    } catch {
        return 'unknown';
    }
}

/**
 * Clear translation cache
 */
export function clearTranslationCache() {
    translationCache.clear();
}
