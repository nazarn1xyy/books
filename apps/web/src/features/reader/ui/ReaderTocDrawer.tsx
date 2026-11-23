import { X } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { Drawer } from '@/shared/ui/Drawer';

interface ReaderTocDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    chapters: { title: string; paragraphIndex: number }[];
    currentParagraphIndex: number;
    onSelectChapter: (paragraphIndex: number) => void;
}

export function ReaderTocDrawer({
    isOpen,
    onClose,
    chapters,
    currentParagraphIndex,
    onSelectChapter
}: ReaderTocDrawerProps) {
    const { t } = useLanguage();

    return (
        <Drawer
            open={isOpen}
            onClose={onClose}
            title={t('reader.tocTitle')}
            className="h-full bg-[var(--reader-bg)] border-l border-[color-mix(in_srgb,var(--reader-text)_12%,transparent)] flex flex-col shadow-2xl"
        >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[color-mix(in_srgb,var(--reader-text)_12%,transparent)] pt-[calc(env(safe-area-inset-top)+min(env(safe-area-inset-top),10px)+1rem)]">
                            <h2 className="text-[var(--reader-text)] font-semibold text-lg">{t('reader.tocTitle')}</h2>
                            <button
                                onClick={onClose}
                                aria-label={t('aria.closeToc')}
                                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center reader-muted hover:text-[var(--reader-text)] transition-colors rounded-full active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                            {chapters.map((ch, i) => {
                                const isCurrent = currentParagraphIndex >= ch.paragraphIndex &&
                                    currentParagraphIndex < (chapters[i + 1]?.paragraphIndex ?? Infinity);
                                return (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            onSelectChapter(ch.paragraphIndex);
                                            onClose();
                                        }}
                                        aria-current={isCurrent ? 'location' : undefined}
                                        className={`w-full text-left px-5 py-3.5 min-h-[44px] transition-colors active:opacity-60 text-[var(--reader-text)] ${
                                            isCurrent ? 'reader-fill font-semibold' : 'hover:reader-fill'
                                        }`}
                                    >
                                        {!ch.title.trim() && <span className="text-xs reader-muted block mb-0.5">{t('reader.chapter', { index: i + 1 })}</span>}
                                        <span className="text-sm font-medium line-clamp-2">{ch.title.trim() || t('reader.chapter', { index: i + 1 })}</span>
                                    </button>
                                );
                            })}
                        </div>
        </Drawer>
    );
}
