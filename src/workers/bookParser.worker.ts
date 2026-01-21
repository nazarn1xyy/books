import JSZip from 'jszip';

function detectEncoding(buffer: Uint8Array): string {
    try {
        // Read the first 1024 bytes as ASCII to find the XML encoding declaration
        const header = new TextDecoder('ascii').decode(buffer.slice(0, 1024));
        const match = header.match(/encoding=["']([a-zA-Z0-9-_]+)["']/i);
        if (match && match[1]) {
            console.log('Detected encoding:', match[1]);
            return match[1];
        }
    } catch (e) {
        // Ignore errors, fallback to utf-8
    }
    return 'utf-8';
}

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
                // Determine encoding from the raw bytes of the internal file
                // JSZip gives us a helper to get Uint8Array
                const fileData = await fb2File.async('uint8array');
                const encoding = detectEncoding(fileData);
                const decoder = new TextDecoder(encoding);
                xmlText = decoder.decode(fileData);
            } else {
                throw new Error('No .fb2 file found in the archive');
            }
        } else {
            const fileData = new Uint8Array(arrayBuffer);
            const encoding = detectEncoding(fileData);

            // Try to decode with detected encoding, fallback to UTF-8 if it fails
            try {
                const decoder = new TextDecoder(encoding);
                xmlText = decoder.decode(fileData);
            } catch (encodingError) {
                console.warn(`Failed to decode with ${encoding}, trying UTF-8`, encodingError);
                const decoder = new TextDecoder('utf-8');
                xmlText = decoder.decode(fileData);
            }
        }

        self.postMessage({ type: 'SUCCESS', text: xmlText });

    } catch (error) {
        self.postMessage({ type: 'ERROR', error: (error as Error).message });
    }
};
