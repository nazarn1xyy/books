import { useState, useEffect, useRef, useCallback } from 'react';

interface TextToSpeechOptions {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: SpeechSynthesisVoice | null;
}

interface TextToSpeechState {
    isSpeaking: boolean;
    isPaused: boolean;
    hasBrowserSupport: boolean;
    voices: SpeechSynthesisVoice[];
}

export function useTextToSpeech() {
    const [state, setState] = useState<TextToSpeechState>({
        isSpeaking: false,
        isPaused: false,
        hasBrowserSupport: 'speechSynthesis' in window,
        voices: []
    });

    const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
    const synthesis = useRef(window.speechSynthesis);

    useEffect(() => {
        if (!state.hasBrowserSupport) return;

        const loadVoices = () => {
            const voices = synthesis.current.getVoices();
            setState(prev => ({ ...prev, voices }));
        };

        loadVoices();

        // Chrome loads voices asynchronously
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadVoices;
        }

        return () => {
            // Cleanup on unmount not strictly necessary here as we might want persistence, 
            // but good practice to cancel if component unmounts while speaking? 
            // Ideally we want global persistence, but for now local to component logic is fine.
            // We won't cancel on unmount to allow background playing if possible (though browsers restrict this).
        };
    }, [state.hasBrowserSupport]);

    const speak = useCallback((text: string, options: TextToSpeechOptions = {}, onEnd?: () => void) => {
        if (!state.hasBrowserSupport) return;

        // Cancel current speech
        synthesis.current.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        if (options.rate) utterance.rate = options.rate;
        if (options.pitch) utterance.pitch = options.pitch;
        if (options.volume) utterance.volume = options.volume;
        if (options.voice) utterance.voice = options.voice;

        // Try to select a Russian voice by default if none provided
        if (!options.voice) {
            const ruVoice = state.voices.find(v => v.lang.startsWith('ru'));
            if (ruVoice) utterance.voice = ruVoice;
        }

        utterance.onstart = () => {
            setState(prev => ({ ...prev, isSpeaking: true, isPaused: false }));
        };

        utterance.onend = () => {
            setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
            if (onEnd) onEnd();
        };

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
        };

        setCurrentUtterance(utterance);
        synthesis.current.speak(utterance);
    }, [state.hasBrowserSupport, state.voices]);

    const pause = useCallback(() => {
        if (!state.hasBrowserSupport) return;
        synthesis.current.pause();
        setState(prev => ({ ...prev, isPaused: true }));
    }, [state.hasBrowserSupport]);

    const resume = useCallback(() => {
        if (!state.hasBrowserSupport) return;
        synthesis.current.resume();
        setState(prev => ({ ...prev, isPaused: false }));
    }, [state.hasBrowserSupport]);

    const cancel = useCallback(() => {
        if (!state.hasBrowserSupport) return;
        synthesis.current.cancel();
        setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
    }, [state.hasBrowserSupport]);

    return {
        ...state,
        speak,
        pause,
        resume,
        cancel
    };
}
