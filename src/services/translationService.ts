// Google Translate API service for book translation
// Uses the free Google Translate unofficial API

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
 * Translate text using Google Translate API
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

        // Parse Google Translate response format
        // Response is: [[["translated text", "original text", null, null, confidence], ...], ...]
        let translatedText = '';
        if (Array.isArray(data) && Array.isArray(data[0])) {
            for (const sentence of data[0]) {
                if (sentence && sentence[0]) {
                    translatedText += sentence[0];
                }
            }
        }

        if (!translatedText) {
            throw new Error('Empty translation result');
        }

        // Cache the result
        translationCache.set(cacheKey, translatedText);

        return translatedText;
    } catch (error) {
        console.error('Translation error:', error);
        throw new Error('Не вдалося перекласти текст. Спробуйте пізніше.');
    }
}

/**
 * Translate multiple paragraphs with progress callback
 */
export async function translateParagraphs(
    paragraphs: string[],
    targetLang: TranslationLanguage,
    onProgress?: (current: number, total: number) => void
): Promise<string[]> {
    const results: string[] = [];
    const total = paragraphs.length;

    for (let i = 0; i < paragraphs.length; i++) {
        const translated = await translateText(paragraphs[i], targetLang);
        results.push(translated);
        onProgress?.(i + 1, total);

        // Small delay to avoid rate limiting
        if (i < paragraphs.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
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
            q: text.slice(0, 200), // Only use first 200 chars for detection
        });

        const response = await fetch(`${TRANSLATE_URL}?${params}`);
        const data = await response.json();

        // Detected language is at index [2]
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
