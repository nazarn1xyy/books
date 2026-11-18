import { Play, Pause, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { usePresence } from '../../shared/ui/usePresence';

interface ReaderTtsControlsProps {
    isVisible: boolean;
    onClose: () => void;
    isSpeaking: boolean;
    isPaused: boolean;
    ttsRate: number;
    onChangeRate: () => void;
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
}

export function ReaderTtsControls({
    isVisible,
    onClose,
    isSpeaking,
    isPaused,
    ttsRate,
    onChangeRate,
    onTogglePlay,
    onPrev,
    onNext
}: ReaderTtsControlsProps) {
    const { t } = useLanguage();
    const { mounted, visible } = usePresence(isVisible);
    if (!mounted) return null;

    return (
                <div
                    className={`fixed bottom-24 left-4 right-4 z-40 flex justify-center pointer-events-none transition-[opacity,transform] duration-200 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}
                >
                    <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 max-w-md w-full justify-between px-6 pointer-events-auto">
                        <button
                            onClick={onChangeRate}
                            className="text-gray-400 text-xs font-bold w-10 text-center flex flex-col items-center active:scale-95 transition-transform"
                            aria-label={t('reader.speed')}
                        >
                            <span className="text-white text-sm">{ttsRate}x</span>
                            <span className="text-[10px]">{t('reader.speed')}</span>
                        </button>

                        <div className="flex items-center gap-6">
                            <button
                                onClick={onPrev}
                                className="text-white active:scale-95 active:opacity-70 transition-all p-2"
                                aria-label={t('aria.prevParagraph')}
                            >
                                <Play size={24} className="rotate-180" fill="currentColor" />
                            </button>

                            <button
                                onClick={onTogglePlay}
                                className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center active:scale-95 shadow-lg active:opacity-90 transition-all"
                                aria-label={isSpeaking && !isPaused ? t('aria.pauseReadAloud') : t('aria.readAloud')}
                            >
                                {isSpeaking && !isPaused ? (
                                    <Pause size={28} fill="currentColor" />
                                ) : (
                                    <Play size={28} fill="currentColor" className="ml-1" />
                                )}
                            </button>

                            <button
                                onClick={onNext}
                                className="text-white active:scale-95 active:opacity-70 transition-all p-2"
                                aria-label={t('aria.nextParagraph')}
                            >
                                <Play size={24} fill="currentColor" />
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white active:scale-95 p-2 rounded-full transition-colors"
                            aria-label={t('common.close')}
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
    );
}
