import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

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
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    {/* Drawer Panel Sliding in from Right */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                        className="relative w-full max-w-xs h-full bg-[var(--reader-bg)] border-l border-white/10 flex flex-col shadow-2xl z-10"
                        style={{ backgroundColor: 'var(--reader-bg)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 pt-[calc(env(safe-area-inset-top)+1rem)]">
                            <h2 className="text-[var(--reader-text)] font-semibold text-lg">{t('reader.tocTitle')}</h2>
                            <button
                                onClick={onClose}
                                aria-label={t('aria.closeToc')}
                                className="p-2 text-gray-400 hover:text-[var(--reader-text)] transition-colors rounded-full active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                            {chapters.map((ch, i) => {
                                const isCurrent = currentParagraphIndex >= ch.paragraphIndex &&
                                    (i === chapters.length - 1 || currentParagraphIndex < chapters[i + 1].paragraphIndex);
                                return (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            onSelectChapter(ch.paragraphIndex);
                                            onClose();
                                        }}
                                        className={`w-full text-left px-5 py-3.5 transition-colors active:opacity-60 ${
                                            isCurrent ? 'text-blue-400 bg-blue-400/10 font-semibold' : 'text-[var(--reader-text)] hover:bg-white/5'
                                        }`}
                                    >
                                        <span className="text-xs text-gray-500 block mb-0.5">{t('reader.chapter', { index: i + 1 })}</span>
                                        <span className="text-sm font-medium line-clamp-2">{ch.title}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
