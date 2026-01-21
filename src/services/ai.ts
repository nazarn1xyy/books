const API_KEY = 'ozNuUIEEFB1kvZYEpFycMEN4uX9D9TuJ'; // Client-side key for demo
const BASE_URL = 'https://glhf.chat/api/openai/v1';

export interface AISummaryResponse {
    summary: string;
    error?: string;
}

export async function summarizeText(text: string): Promise<AISummaryResponse> {
    try {
        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "hf:meta-llama/Meta-Llama-3.1-70B-Instruct", // or another available model
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
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No content in response');
        }

        return { summary: content };

    } catch (error) {
        console.error('AI Summarization failed:', error);
        return {
            summary: '',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
