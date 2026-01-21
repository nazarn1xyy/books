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
        // Handle cases where body might be a string (sometimes happens if content-type isn't perfect)
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
        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "hf:meta-llama/Meta-Llama-3.1-70B-Instruct",
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
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Upstream API Error:', response.status, errorText);
            // Return the actual error to the client for debugging
            return res.status(response.status).json({
                error: 'Upstream API Error',
                status: response.status,
                details: errorText
            });
        }

        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content;

        if (!summary) {
            return res.status(502).json({ error: 'Invalid response from AI provider', data });
        }

        return res.status(200).json({ summary });

    } catch (error) {
        console.error('AI Proxy Error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
            stack: error.stack
        });
    }
}
