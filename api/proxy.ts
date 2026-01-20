


export const config = {
    runtime: 'edge', // Use Edge for speed, supports standard fetch
};

export default async function handler(req: Request) {
    const url = new URL(req.url);
    // Extract the path after /api/proxy (or however it's routed)
    // We expect the rewrite to map /flibusta/... -> /api/proxy?path=...
    // But easier: check the request URL parameters from the query string

    const targetPath = url.searchParams.get('path');
    const query = url.searchParams.toString().replace(`path=${encodeURIComponent(targetPath || '')}&`, '').replace(`&path=${encodeURIComponent(targetPath || '')}`, '');

    // Reconstruct the target URL.
    // Using http://flibusta.is directly to avoid redirects and mixed content issues.
    // The server-side fetch has no mixed-content restrictions.
    const target = `http://flibusta.is/${targetPath}${query ? '?' + query : ''}`;

    console.log(`Proxying to: ${target}`);

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
