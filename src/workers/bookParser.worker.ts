import JSZip from 'jszip';

self.onmessage = async (e: MessageEvent) => {
    const { arrayBuffer } = e.data;

    try {
        let xmlText = '';

        // Try to identify if it is a ZIP (PK header)
        const arr = new Uint8Array(arrayBuffer.slice(0, 4));
        const isZip = arr[0] === 0x50 && arr[1] === 0x4B && arr[2] === 0x03 && arr[3] === 0x04;

        if (isZip) {
            const zip = await JSZip.loadAsync(arrayBuffer);
            const fb2File = Object.values(zip.files).find(file => file.name.endsWith('.fb2'));

            if (fb2File) {
                xmlText = await fb2File.async('string');
            } else {
                throw new Error('No .fb2 file found in the archive');
            }
        } else {
            const decoder = new TextDecoder('utf-8');
            xmlText = decoder.decode(arrayBuffer);
        }

        // We can't use DOMParser in a Worker easily without polyfills or manual regex parsing
        // deeply. However, simple extraction is possible.
        // Or we pass the text back and parse DOM on main thread, but at least ZIP is offloaded.
        // Actually, for maximum speed, let's just return the text. 
        // Parsing DOM is fast, it's the large string decoding and unzipping that hurts.

        // Let's create a lightweight parser here to avoid sending huge XML string back if we can avoid it.
        // But we need the structure. 

        // Optimization: Just extracting body text paragraphs using Regex to avoid DOM overhead on main thread?
        // No, we might lose structure. Let's send back the XML text. The unzipping is the heaviest part.

        self.postMessage({ type: 'SUCCESS', text: xmlText });

    } catch (error) {
        self.postMessage({ type: 'ERROR', error: (error as Error).message });
    }
};
