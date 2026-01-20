// Critical: Cache Recovery Script
// If the main bundle fails to load (MIME error / SyntaxError), unregister SW and reload.
window.addEventListener('error', async function (e) {
    const msg = e.message?.toLowerCase() || '';
    const isChunkError = msg.includes('token') || msg.includes('syntax') || msg.includes('script error') || msg.includes('mime');

    if (e.target && (e.target.tagName === 'SCRIPT' || isChunkError)) {
        console.error('Critical boot error detected:', e);

        // Unregister Service Workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }

        // Reload if not already reloaded recently (check sessionStorage)
        if (!sessionStorage.getItem('retry_boot')) {
            sessionStorage.setItem('retry_boot', 'true');
            window.location.reload();
        } else {
            sessionStorage.removeItem('retry_boot'); // Reset for next valid session
        }
    }
}, true);
