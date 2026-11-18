import { useState, useEffect } from 'react';

export function useKeyboardHeight() {
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

    useEffect(() => {
        // Check if visualViewport is available (modern browsers)
        if (!window.visualViewport) return;

        const handleResize = () => {
            const viewport = window.visualViewport!;
            // Calculate keyboard height: difference between window height and viewport height
            const currentKeyboardHeight = window.innerHeight - viewport.height;

            // Only consider it "keyboard open" if height is significant (> 100px)
            const isOpen = currentKeyboardHeight > 100;

            setKeyboardHeight(isOpen ? currentKeyboardHeight : 0);
            setIsKeyboardOpen(isOpen);
        };

        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);

        // Initial check
        handleResize();

        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('scroll', handleResize);
        };
    }, []);

    return { keyboardHeight, isKeyboardOpen };
}
