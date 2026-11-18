import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { TRANSLATION_LANGUAGES, type TranslationLanguage } from '../../services/translationService';
import { useLanguage } from '../../contexts/LanguageContext';

interface ReaderTranslateModalProps {
    isOpen: boolean;
    onClose: () => void;
    isTranslating: boolean;
    translationLang: TranslationLanguage | null;
    translationProgress: { current: number; total: number };
    onSelectLanguage: (lang: TranslationLanguage) => void;
    onDisableTranslation: () => void;
}

export function ReaderTranslateModal({
    isOpen,
    onClose,
    isTranslating,
    translationLang,
    translationProgress,
    onSelectLanguage,
    onDisableTranslation
}: ReaderTranslateModalProps) {
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
                        className="relative w-full max-w-lg bg-[var(--reader-ui-bg)] rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl z-10 touch-pan-y"
                        style={{ backgroundColor: 'var(--reader-ui-bg)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle */}
                        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-[var(--reader-text)]">{t('reader.translateModalTitle')}</h2>
                            <button
                                onClick={onClose}
                                aria-label={t('common.close')}
                                className="p-2 -mr-2 text-gray-400 hover:text-[var(--reader-text)] transition-colors rounded-full active:scale-95"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {isTranslating ? (
                            <div className="py-8 text-center">
                                <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-blue-400" />
                                <p className="text-[var(--reader-text)] mb-2 font-medium">{t('reader.translating')}</p>
                                <p className="text-gray-400 text-sm">
                                    {translationProgress.current} / {translationProgress.total} {t('myBooks.paragraph', { index: '' }).trim()}
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className="text-gray-400 text-sm mb-4">
                                    {t('reader.selectLanguage')}
                                </p>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {TRANSLATION_LANGUAGES.map((lang) => (
                                        <button
                                            key={lang.code}
                                            onClick={() => onSelectLanguage(lang.code)}
                                            className={`flex items-center gap-3 p-4 rounded-xl transition-all active:scale-95 ${
                                                translationLang === lang.code
                                                    ? 'bg-green-500/20 border-2 border-green-500 text-[var(--reader-text)] font-semibold'
                                                    : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-[var(--reader-text)]'
                                            }`}
                                        >
                                            <span className="text-2xl">{lang.flag}</span>
                                            <span className="text-sm font-medium">{lang.name}</span>
                                        </button>
                                    ))}
                                </div>

                                {translationLang && (
                                    <button
                                        onClick={onDisableTranslation}
                                        className="w-full py-3 rounded-xl bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition-colors active:scale-95"
                                    >
                                        {t('reader.disableTranslation')}
                                    </button>
                                )}
                            </>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
