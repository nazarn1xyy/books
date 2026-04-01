


export const config = {
    runtime: 'edge', // Use Edge for speed, supports standard fetch
};

export default async function handler(req: Request) {
    const url = new URL(req.url);

    const targetPath = url.searchParams.get('path') || '';
    const host = url.searchParams.get('host') || 'flibusta.is';

    // Strip internal routing params; forward any remaining query string to the target
    const forwardParams = new URLSearchParams(url.searchParams);
    forwardParams.delete('path');
    forwardParams.delete('host');
    const queryString = forwardParams.toString();

    const target = `http://${host}/${targetPath}${queryString ? '?' + queryString : ''}`;

    try {
        const response = await fetch(target, {
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Libify/1.0)',
                // Don't forward all headers to avoid issues (host, etc)
            }
        });

        // Create a new response to return
        const newHeaders = new Headers(response.headers);

        // Fix CORS if needed (though we render same origin)
        newHeaders.set('Access-Control-Allow-Origin', '*');

        // Remove headers that might cause issues
        newHeaders.delete('Content-Encoding'); // Let Vercel handle compression
        newHeaders.delete('Content-Length');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });

    } catch (e) {
        console.error('Proxy error:', e);
        return new Response('Proxy Error', { status: 500 });
    }
}
