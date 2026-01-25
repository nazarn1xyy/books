// Google Translate API service for book translation
// Uses the free Google Translate unofficial API - OPTIMIZED with parallel requests

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

/**
 * Translate single text using Google Translate API
 */
export async function translateText(
    text: string,
    targetLang: TranslationLanguage,
    sourceLang: string = 'auto'
): Promise<string> {
    if (!text.trim()) return text;

    // Check cache first
    const cacheKey = `${sourceLang}:${targetLang}:${text}`;
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey)!;
    }

    try {
        const params = new URLSearchParams({
            client: 'gtx',
            sl: sourceLang,
            tl: targetLang,
            dt: 't',
            q: text,
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

        if (!translatedText) {
            return text; // Return original if translation fails
        }

        // Cache the result
        translationCache.set(cacheKey, translatedText);

        return translatedText;
    } catch (error) {
        console.error('Translation error:', error);
        return text; // Return original on error
    }
}

/**
 * Translate multiple paragraphs with progress callback - OPTIMIZED
 * Uses parallel requests (5 at a time) for speed
 */
export async function translateParagraphs(
    paragraphs: string[],
    targetLang: TranslationLanguage,
    onProgress?: (current: number, total: number) => void
): Promise<string[]> {
    const results: string[] = new Array(paragraphs.length);
    const total = paragraphs.length;
    const PARALLEL_COUNT = 5; // 5 parallel requests at a time

    let completed = 0;

    // Process in parallel batches
    for (let i = 0; i < paragraphs.length; i += PARALLEL_COUNT) {
        const batch = paragraphs.slice(i, i + PARALLEL_COUNT);
        const startIndex = i;

        const promises = batch.map(async (para, batchIndex) => {
            const translated = await translateText(para, targetLang);
            results[startIndex + batchIndex] = translated;
            completed++;
            onProgress?.(completed, total);
        });

        await Promise.all(promises);
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
