import JSZip from 'jszip';
import { getBookMetadata } from './storage';
import { getCachedBook } from './cache';

export interface ExportProgress {
    current: number;
    total: number;
    bookTitle: string;
}

/**
 * Export all books in the user's library as a ZIP file
 */
export async function exportAllBooks(
    bookIds: string[],
    onProgress?: (progress: ExportProgress) => void
): Promise<void> {
    const zip = new JSZip();
    let successful = 0;

    for (let i = 0; i < bookIds.length; i++) {
        const bookId = bookIds[i];
        const metadata = getBookMetadata(bookId);

        if (onProgress && metadata) {
            onProgress({
                current: i + 1,
                total: bookIds.length,
                bookTitle: metadata.title || 'Unknown'
            });
        }

        try {
            // Try to get cached book content
            const cachedContent = await getCachedBook(bookId);

            if (cachedContent) {
                // Determine file extension
                const ext = metadata?.format === 'pdf' ? 'pdf' : 'fb2';
                // Sanitize filename
                const safeTitle = (metadata?.title || `book_${bookId}`)
                    .replace(/[<>:"/\\|?*]/g, '_')
                    .substring(0, 100);
                const filename = `${safeTitle}.${ext}`;

                // Add to ZIP
                if (cachedContent.pdfData) {
                    zip.file(filename, cachedContent.pdfData);
                    successful++;
                } else if (cachedContent.text) {
                    // For FB2, we store as text. Ideally we'd have the original file.
                    // But we can create a simple FB2 structure
                    const fb2Content = createSimpleFB2(
                        metadata?.title || 'Untitled',
                        metadata?.author || 'Unknown',
                        cachedContent.text
                    );
                    zip.file(filename, fb2Content);
                    successful++;
                }
            }
        } catch (error) {
            console.error(`Failed to export book ${bookId}:`, error);
        }
    }

    if (successful === 0) {
        throw new Error('Не удалось экспортировать ни одной книги. Убедитесь, что книги загружены в кеш.');
    }

    // Generate ZIP
    const blob = await zip.generateAsync({ type: 'blob' });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Library_Backup_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Create a basic FB2 file from text content
 */
function createSimpleFB2(title: string, author: string, text: string): string {
    const escapedTitle = escapeXml(title);
    const escapedAuthor = escapeXml(author);
    const escapedText = escapeXml(text);

    return `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
    <description>
        <title-info>
            <book-title>${escapedTitle}</book-title>
            <author>
                <first-name>${escapedAuthor}</first-name>
            </author>
        </title-info>
    </description>
    <body>
        <section>
            <p>${escapedText.replace(/\n/g, '</p>\n            <p>')}</p>
        </section>
    </body>
</FictionBook>`;
}

function escapeXml(unsafe: string): string {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
