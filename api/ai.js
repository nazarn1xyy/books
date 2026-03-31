export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    let text;
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        text = body?.text;
    } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body', details: e.message });
    }

    if (!text) {
        return res.status(400).json({ error: 'No text provided', body: req.body });
    }

    // Use environment variable or fallback to the provided key
    const API_KEY = process.env.GLHF_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'AI service not configured' });
    }
    const BASE_URL = 'https://glhf.chat/api/openai/v1';

    try {
        console.log('Sending request to GLHF...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                model: "hf:meta-llama/Meta-Llama-3-8B-Instruct",
                messages: [
                    {
                        role: "system",
                        content: "Ты — умный помощник для чтения. Твоя задача — кратко пересказать предоставленный текст (контекст текущей главы или страницы), чтобы напомнить читателю, о чем идет речь. Делай пересказ сжатым (до 150 слов), понятным и на русском языке."
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.7,
                max_tokens: 300
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Upstream API status: ${response.status}`);
        }

        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content;

        if (!summary) throw new Error('No summary in response');

        return res.status(200).json({ summary });

    } catch (error) {
        console.error('AI API Failed, switching to fallback:', error.message);

        // FALLBACK: Intelligent Extractive Summarization
        // Extract key sentences to create a coherent summary

        // Split into sentences
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

        // Remove very short sentences (likely fragments)
        const meaningfulSentences = sentences.filter(s => s.trim().length > 30);

        let summary = '';

        if (meaningfulSentences.length <= 5) {
            // Short text - use it all
            summary = text.trim();
        } else {
            // Longer text - extract key parts
            const totalSentences = meaningfulSentences.length;

            // Take first 2 sentences (introduction/context)
            const intro = meaningfulSentences.slice(0, 2).join(' ');

            // Take 2-3 sentences from middle (main content)
            const midStart = Math.floor(totalSentences * 0.4);
            const middle = meaningfulSentences.slice(midStart, midStart + 3).join(' ');

            // Take last 1-2 sentences (conclusion/current point)
            const conclusion = meaningfulSentences.slice(-2).join(' ');

            // Combine with proper formatting
            summary = `${intro}\n\n${middle}\n\n${conclusion}`;

            // Limit total length
            if (summary.length > 800) {
                summary = summary.substring(0, 800) + '...';
            }
        }

        // Format nicely without error warning
        const formattedSummary = `📖 **Краткое содержание:**\n\n${summary.trim()}`;

        return res.status(200).json({
            summary: formattedSummary,
            isFallback: true
        });
    }
}
