import { useState, useEffect, useRef } from 'react';

interface UseCameraStreamResult {
    stream: MediaStream | null;
    error: Error | null;
    isActive: boolean;
    startCamera: () => Promise<void>;
    stopCamera: () => void;
}

export function useCameraStream(): UseCameraStreamResult {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isActive, setIsActive] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);

    const startCamera = async () => {
        try {
            const constraints = {
                video: {
                    facingMode: 'environment' // Use rear camera if available
                },
                audio: false
            };

            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);
            streamRef.current = mediaStream;
            setIsActive(true);
            setError(null);
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError(err instanceof Error ? err : new Error('Failed to access camera'));
            setIsActive(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setStream(null);
        setIsActive(false);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return { stream, error, isActive, startCamera, stopCamera };
}
