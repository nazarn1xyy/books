import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        const handler = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Check if installed via appinstalled event
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
            setInstallPrompt(null);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const promptInstall = async () => {
        if (!installPrompt) return false;

        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;

        if (choice.outcome === 'accepted') {
            setInstallPrompt(null);
            return true;
        }
        return false;
    };

    return {
        installPrompt,
        promptInstall,
        isInstalled,
        canInstall: !!installPrompt && !isInstalled,
    };
}
