import { useState, useCallback, type RefObject } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

const PDF_WORKER_SRC = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

interface ReaderPdfViewerProps {
    pdfData: ArrayBuffer;
    numPages: number;
    setNumPages: (n: number) => void;
    virtuosoRef: RefObject<VirtuosoHandle | null>;
    onRangeChanged: (range: { startIndex: number; endIndex: number }) => void;
}

export function ReaderPdfViewer({
    pdfData,
    numPages,
    setNumPages,
    virtuosoRef,
    onRangeChanged
}: ReaderPdfViewerProps) {
    const [pdfScale, setPdfScale] = useState<number>(1);

    const renderPdfItem = useCallback((index: number) => (
        <div className="flex justify-center py-2 px-2">
            <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                scale={pdfScale}
                width={(window.innerWidth > 768 ? 768 : window.innerWidth - 16)}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="shadow-xl bg-white rounded-sm overflow-hidden"
            />
        </div>
    ), [pdfScale]);

    return (
        <div
            className="h-full w-full overflow-auto touch-pan-x touch-pan-y"
            style={{
                backgroundColor: 'var(--reader-bg)',
            }}
            onTouchStart={(e) => {
                if (e.touches.length === 2) {
                    const dist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    (e.currentTarget as HTMLDivElement).dataset.initialPinchDist = String(dist);
                    (e.currentTarget as HTMLDivElement).dataset.initialScale = String(pdfScale);
                }
            }}
            onTouchMove={(e) => {
                if (e.touches.length === 2) {
                    const initialDist = parseFloat((e.currentTarget as HTMLDivElement).dataset.initialPinchDist || '0');
                    const initialScale = parseFloat((e.currentTarget as HTMLDivElement).dataset.initialScale || '1');
                    if (initialDist > 0) {
                        const dist = Math.hypot(
                            e.touches[0].clientX - e.touches[1].clientX,
                            e.touches[0].clientY - e.touches[1].clientY
                        );
                        const newScale = Math.min(3, Math.max(0.5, initialScale * (dist / initialDist)));
                        setPdfScale(newScale);
                    }
                }
            }}
        >
            {/* Zoom controls */}
            <div className="sticky top-2 left-2 z-10 flex gap-2 p-2 pointer-events-auto">
                <button
                    onClick={() => setPdfScale(s => Math.max(0.5, s - 0.25))}
                    className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center text-xl font-bold backdrop-blur-sm active:scale-90 transition-transform shadow-lg"
                    aria-label="Zoom out"
                >
                    −
                </button>
                <span className="px-3 py-2 rounded-full bg-black/60 text-white text-sm backdrop-blur-sm flex items-center justify-center font-medium shadow-lg">
                    {Math.round(pdfScale * 100)}%
                </span>
                <button
                    onClick={() => setPdfScale(s => Math.min(3, s + 0.25))}
                    className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center text-xl font-bold backdrop-blur-sm active:scale-90 transition-transform shadow-lg"
                    aria-label="Zoom in"
                >
                    +
                </button>
            </div>

            <Document
                file={pdfData}
                onLoadSuccess={({ numPages }) => {
                    setNumPages(numPages);
                }}
                loading={
                    <div className="flex h-full items-center justify-center text-[var(--reader-text)] py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[var(--reader-text)]"></div>
                    </div>
                }
                className="h-full"
            >
                {numPages > 0 && (
                    <Virtuoso
                        ref={virtuosoRef}
                        style={{ height: '100%' }}
                        totalCount={numPages}
                        rangeChanged={onRangeChanged}
                        itemContent={renderPdfItem}
                        components={{
                            Footer: () => <div className="h-24" />,
                        }}
                    />
                )}
            </Document>
        </div>
    );
}

export default ReaderPdfViewer;
