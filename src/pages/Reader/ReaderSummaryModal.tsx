import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Brain } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface ReaderSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    summaryContent: string;
    isGenerating: boolean;
}

export function ReaderSummaryModal({
    isOpen,
    onClose,
    summaryContent,
    isGenerating
}: ReaderSummaryModalProps) {
    const { t } = useLanguage();

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center">
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

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 32, stiffness: 350 }}
                        drag="y"
                        dragConstraints={{ top: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(_e, info) => {
                            if (info.offset.y > 100 || info.velocity.y > 500) {
                                onClose();
                            }
                        }}
                        className="relative w-full max-w-lg bg-[var(--reader-ui-bg)] rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl z-10 touch-pan-y h-[65vh] flex flex-col"
                        style={{ backgroundColor: 'var(--reader-ui-bg)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle */}
                        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Brain className="text-purple-400" size={22} aria-hidden="true" />
                                <h2 className="text-lg font-semibold text-[var(--reader-text)]">{t('reader.aiSummaryTitle')}</h2>
                            </div>
                            <button
                                onClick={onClose}
                                aria-label={t('common.close')}
                                className="p-2 -mr-2 text-gray-400 hover:text-[var(--reader-text)] transition-colors rounded-full active:scale-95"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {isGenerating ? (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                    <Sparkles className="animate-spin text-purple-400" size={32} />
                                    <p className="text-gray-400 text-sm animate-pulse">{t('reader.aiAnalyzing')}</p>
                                </div>
                            ) : (
                                <div className="prose prose-invert prose-sm max-w-none text-[var(--reader-text)] leading-relaxed">
                                    {summaryContent.split('\n').map((line, i) => (
                                        <p key={i} className="mb-2">{line}</p>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Disclaimer */}
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-center">
                            <p className="text-xs text-gray-500">{t('reader.aiSummaryDisclaimer')}</p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
