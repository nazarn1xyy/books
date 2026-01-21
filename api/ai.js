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
    const API_KEY = process.env.GLHF_API_KEY || 'ozNuUIEEFB1kvZYEpFycMEN4uX9D9TuJ';
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

        // FALLBACK: Extractive Summarization
        // If AI fails, we manually extract first and last sentences to give *something* useful.
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        let fallbackSummary = '';

        if (sentences.length <= 3) {
            fallbackSummary = text;
        } else {
            const first = sentences.slice(0, 2).join(' ');
            const middleIndex = Math.floor(sentences.length / 2);
            const middle = sentences.slice(middleIndex, middleIndex + 1).join(' ');
            const last = sentences.slice(-2).join(' ');
            fallbackSummary = `${first} [...пропущено...] ${middle} [...] ${last}`;
        }

        return res.status(200).json({
            summary: "⚠️ AI сервер недоступен. Вот автоматическая выжимка текста:\n\n" + fallbackSummary,
            isFallback: true
        });
    }
}
