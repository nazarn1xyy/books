import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Sun, AlignLeft, Layers } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

import type { UserSettings } from '../../types';

interface ReaderSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: UserSettings;
    isPdf: boolean;
    onUpdateTheme: (theme: 'light' | 'dark' | 'sepia' | 'oled') => void;
    onUpdateFontSize: (delta: number) => void;
    onUpdateFontFamily: (font: 'sans' | 'serif' | 'mono' | 'rounded') => void;
    onUpdateReaderMode: (mode: 'scroll' | 'page') => void;
    onUpdateBrightness: (brightness: number) => void;
}

export function ReaderSettingsModal({
    isOpen,
    onClose,
    settings,
    isPdf,
    onUpdateTheme,
    onUpdateFontSize,
    onUpdateFontFamily,
    onUpdateReaderMode,
    onUpdateBrightness
}: ReaderSettingsModalProps) {
    const { t } = useLanguage();

    const FONT_FAMILIES = {
        sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        serif: "Georgia, 'Times New Roman', serif",
        mono: "'Courier New', Courier, monospace",
        rounded: "'Nunito', 'SF Pro Rounded', ui-rounded, sans-serif",
    };

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
                        className="relative w-full max-w-lg bg-[var(--reader-ui-bg)] rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl z-10 touch-pan-y max-h-[85vh] overflow-y-auto"
                        style={{ backgroundColor: 'var(--reader-ui-bg)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle */}
                        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-[var(--reader-text)]">{t('reader.settings')}</h2>
                            <button
                                onClick={onClose}
                                aria-label={t('aria.closeSettings')}
                                className="p-2 -mr-2 text-gray-400 hover:text-[var(--reader-text)] transition-colors rounded-full active:scale-95"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Theme Selection */}
                        <div className="mb-6">
                            <label className="text-xs font-medium text-gray-400 mb-2.5 block uppercase tracking-wider">{t('reader.theme')}</label>
                            <div className="flex gap-2.5 justify-between">
                                {[
                                    { id: 'light', name: t('reader.themeLight'), bg: '#F2F2F2', border: '#ddd', text: '#000' },
                                    { id: 'sepia', name: t('reader.themeSepia'), bg: '#F8F1E3', border: '#E3DCCF', text: '#5F4B32' },
                                    { id: 'dark', name: t('reader.themeDark'), bg: '#2C2C2E', border: '#3A3A3C', text: '#FFF' },
                                    { id: 'oled', name: t('reader.themeOled'), bg: '#000000', border: '#333', text: '#AAA' },
                                ].map((thm) => (
                                    <button
                                        key={thm.id}
                                        onClick={() => onUpdateTheme(thm.id as 'light' | 'dark' | 'sepia' | 'oled')}
                                        className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-1 transition-all active:scale-95 ${
                                            settings.theme === thm.id ? 'ring-2 ring-blue-500 scale-[1.02]' : ''
                                        }`}
                                        style={{ backgroundColor: thm.bg, borderColor: thm.border }}
                                    >
                                        <span className="text-xs font-semibold" style={{ color: thm.text }}>{thm.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Font Size - Only for local text books */}
                        {!isPdf && (
                            <div className="mb-6">
                                <label className="text-xs font-medium text-gray-400 mb-2.5 block uppercase tracking-wider">{t('reader.fontSize')}</label>
                                <div className="flex items-center justify-between bg-black/10 dark:bg-white/5 rounded-xl p-3.5">
                                    <button
                                        onClick={() => onUpdateFontSize(-2)}
                                        aria-label={t('aria.decreaseFontSize')}
                                        className="p-2 text-[var(--reader-text)] bg-black/10 dark:bg-white/10 rounded-lg active:scale-90 transition-transform"
                                    >
                                        <Minus size={20} />
                                    </button>
                                    <span className="text-[var(--reader-text)] font-semibold text-base">{settings.fontSize}px</span>
                                    <button
                                        onClick={() => onUpdateFontSize(2)}
                                        aria-label={t('aria.increaseFontSize')}
                                        className="p-2 text-[var(--reader-text)] bg-black/10 dark:bg-white/10 rounded-lg active:scale-90 transition-transform"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Font Family */}
                        {!isPdf && (
                            <div className="mb-6">
                                <label className="text-xs font-medium text-gray-400 mb-2.5 block uppercase tracking-wider">{t('reader.fontFamily')}</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {([
                                        { key: 'sans', label: t('reader.fontSans'), sample: 'Aa' },
                                        { key: 'serif', label: t('reader.fontSerif'), sample: 'Aa' },
                                        { key: 'mono', label: t('reader.fontMono'), sample: 'Aa' },
                                        { key: 'rounded', label: t('reader.fontRounded'), sample: 'Aa' },
                                    ] as const).map(f => (
                                        <button
                                            key={f.key}
                                            onClick={() => onUpdateFontFamily(f.key)}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all active:scale-95 ${
                                                settings.fontFamily === f.key ? 'bg-white/20 ring-1 ring-white/40 font-semibold' : 'bg-black/10 dark:bg-white/5 text-gray-400'
                                            }`}
                                        >
                                            <span className="text-[var(--reader-text)] text-lg leading-none" style={{ fontFamily: FONT_FAMILIES[f.key] }}>{f.sample}</span>
                                            <span className="text-[10px] truncate max-w-full">{f.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Reader Mode Toggle */}
                        {!isPdf && (
                            <div className="mb-6">
                                <label className="text-xs font-medium text-gray-400 mb-2.5 block uppercase tracking-wider">{t('reader.readingMode')}</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => onUpdateReaderMode('scroll')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl transition-all active:scale-95 ${
                                            settings.readerMode !== 'page'
                                                ? 'bg-white/20 text-[var(--reader-text)] font-semibold'
                                                : 'bg-black/10 dark:bg-white/5 text-gray-400'
                                        }`}
                                    >
                                        <AlignLeft size={18} />
                                        <span className="text-sm">{t('reader.scroll')}</span>
                                    </button>
                                    <button
                                        onClick={() => onUpdateReaderMode('page')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl transition-all active:scale-95 ${
                                            settings.readerMode === 'page'
                                                ? 'bg-white/20 text-[var(--reader-text)] font-semibold'
                                                : 'bg-black/10 dark:bg-white/5 text-gray-400'
                                        }`}
                                    >
                                        <Layers size={18} />
                                        <span className="text-sm">{t('reader.pageFlip')}</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Brightness */}
                        <div>
                            <label className="text-xs font-medium text-gray-400 mb-2.5 block uppercase tracking-wider">{t('reader.brightness')}</label>
                            <div className="flex items-center gap-4 bg-black/10 dark:bg-white/5 rounded-xl p-3.5">
                                <Sun size={20} className="text-gray-500" aria-hidden="true" />
                                <input
                                    type="range"
                                    min="30"
                                    max="100"
                                    value={settings.brightness}
                                    onChange={(e) => onUpdateBrightness(Number(e.target.value))}
                                    className="flex-1 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-[var(--reader-text)]"
                                    aria-label={t('reader.brightness')}
                                />
                                <span className="text-[var(--reader-text)] font-semibold text-sm w-10 text-right">{settings.brightness}%</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
