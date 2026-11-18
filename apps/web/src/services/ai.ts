export interface AISummaryResponse {
    summary: string;
    error?: string;
}

export async function summarizeText(text: string): Promise<AISummaryResponse> {
    try {
        // Call our own Vercel API function (proxy)
        // This avoids CORS issues with the external API
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            throw new Error(`Proxy API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        if (!data.summary) {
            throw new Error('No summary received');
        }

        return { summary: data.summary };

    } catch (error) {
        console.error('AI Summarization failed:', error);
        return {
            summary: '',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
