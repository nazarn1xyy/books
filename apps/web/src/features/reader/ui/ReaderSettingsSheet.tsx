import { X, Minus, Plus, Sun, AlignLeft, Layers } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { Sheet } from '@/shared/ui/Sheet';
import { FONT_FAMILIES } from '../model/fontFamilies';
import type { ReaderSettings } from '../model/readerSettingsStore';
import { useReaderSettings } from '../model/useReaderSettings';

interface ReaderSettingsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    isPdf: boolean;
    /** Side effect of switching mode (e.g. open the page with the current paragraph). */
    onReaderModeChange?: (mode: ReaderSettings['readerMode']) => void;
}

/** Reader appearance settings; reads and writes the reader settings store directly. */
export function ReaderSettingsSheet({ isOpen, onClose, isPdf, onReaderModeChange }: ReaderSettingsSheetProps) {
    const { t } = useLanguage();
    const settings = useReaderSettings((s) => s);
    const onUpdateTheme = settings.setTheme;
    const onUpdateFontSize = settings.changeFontSize;
    const onUpdateFontFamily = settings.setFontFamily;
    const onUpdateBrightness = settings.setBrightness;
    const onUpdateReaderMode = (mode: ReaderSettings['readerMode']) => {
        settings.setReaderMode(mode);
        onReaderModeChange?.(mode);
    };

    return (
        <Sheet
            portal={false}
            open={isOpen}
            onClose={onClose}
            title={t('reader.settings')}
            placement="bottom"
            swipeToClose
            surfaceClassName="bg-[var(--reader-ui-bg)] rounded-t-3xl"
            className="w-full max-w-lg max-h-[85dvh] overflow-y-auto overscroll-contain p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] touch-pan-y"
        >
                        {/* Drag Handle */}
                        <div className="w-10 h-1 reader-fill rounded-full mx-auto mb-4" />

                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-[var(--reader-text)]">{t('reader.settings')}</h2>
                            <button
                                onClick={onClose}
                                aria-label={t('aria.closeSettings')}
                                className="p-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center reader-muted hover:text-[var(--reader-text)] transition-colors rounded-full active:scale-95"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Theme Selection */}
                        <div className="mb-6">
                            <label className="text-xs font-medium reader-muted mb-2.5 block uppercase tracking-wider">{t('reader.theme')}</label>
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
                                <label className="text-xs font-medium reader-muted mb-2.5 block uppercase tracking-wider">{t('reader.fontSize')}</label>
                                <div className="flex items-center justify-between reader-fill rounded-xl p-3.5">
                                    <button
                                        onClick={() => onUpdateFontSize(-2)}
                                        aria-label={t('aria.decreaseFontSize')}
                                        className="p-2 text-[var(--reader-text)] reader-fill rounded-lg active:scale-90 transition-transform"
                                    >
                                        <Minus size={20} />
                                    </button>
                                    <span className="text-[var(--reader-text)] font-semibold text-base">{settings.fontSize}px</span>
                                    <button
                                        onClick={() => onUpdateFontSize(2)}
                                        aria-label={t('aria.increaseFontSize')}
                                        className="p-2 text-[var(--reader-text)] reader-fill rounded-lg active:scale-90 transition-transform"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Font Family */}
                        {!isPdf && (
                            <div className="mb-6">
                                <label className="text-xs font-medium reader-muted mb-2.5 block uppercase tracking-wider">{t('reader.fontFamily')}</label>
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
                                                settings.fontFamily === f.key ? 'reader-selected' : 'reader-fill reader-muted'
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
                                <label className="text-xs font-medium reader-muted mb-2.5 block uppercase tracking-wider">{t('reader.readingMode')}</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => onUpdateReaderMode('scroll')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl transition-all active:scale-95 ${
                                            settings.readerMode !== 'page'
                                                ? 'reader-selected'
                                                : 'reader-fill reader-muted'
                                        }`}
                                    >
                                        <AlignLeft size={18} />
                                        <span className="text-sm">{t('reader.scroll')}</span>
                                    </button>
                                    <button
                                        onClick={() => onUpdateReaderMode('page')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl transition-all active:scale-95 ${
                                            settings.readerMode === 'page'
                                                ? 'reader-selected'
                                                : 'reader-fill reader-muted'
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
                            <label className="text-xs font-medium reader-muted mb-2.5 block uppercase tracking-wider">{t('reader.brightness')}</label>
                            <div className="flex items-center gap-4 reader-fill rounded-xl p-3.5">
                                <Sun size={20} className="reader-muted" aria-hidden="true" />
                                <input
                                    type="range"
                                    min="30"
                                    max="100"
                                    value={settings.brightness}
                                    onChange={(e) => onUpdateBrightness(Number(e.target.value))}
                                    className="flex-1 h-1 reader-fill rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-[var(--reader-text)]"
                                    aria-label={t('reader.brightness')}
                                />
                                <span className="text-[var(--reader-text)] font-semibold text-sm w-10 text-right">{settings.brightness}%</span>
                            </div>
                        </div>
        </Sheet>
    );
}
