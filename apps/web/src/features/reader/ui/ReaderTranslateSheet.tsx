import { X, Loader2 } from 'lucide-react';
import { TRANSLATION_LANGUAGES, type TranslationLanguage } from '@/shared/lib/translationService';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { Sheet } from '@/shared/ui/Sheet';

interface ReaderTranslateSheetProps {
    isOpen: boolean;
    onClose: () => void;
    isTranslating: boolean;
    translationLang: TranslationLanguage | null;
    translationProgress: { current: number; total: number };
    onSelectLanguage: (lang: TranslationLanguage) => void;
    onDisableTranslation: () => void;
}

export function ReaderTranslateSheet({
    isOpen,
    onClose,
    isTranslating,
    translationLang,
    translationProgress,
    onSelectLanguage,
    onDisableTranslation
}: ReaderTranslateSheetProps) {
    const { t } = useLanguage();

    return (
        <Sheet
            open={isOpen}
            onClose={onClose}
            title={t('reader.translate')}
            placement="bottom"
            swipeToClose
            surfaceClassName="bg-[var(--reader-ui-bg)] rounded-t-3xl"
            className="w-full max-w-lg p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] touch-pan-y"
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
        </Sheet>
    );
}
