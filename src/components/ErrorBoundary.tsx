import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);

        const msg = error.message?.toLowerCase() || '';
        const isChunkError =
            msg.includes('loading chunk') ||
            msg.includes('importing a module script failed') ||
            msg.includes('token') ||
            msg.includes('syntax') ||
            msg.includes('mime');

        if (isChunkError || error.name === 'SyntaxError') {
            console.log('Chunk/MIME error detected, forcing hard reload...');

            // Clear SW cache if possible
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    for (const registration of registrations) {
                        registration.unregister();
                    }
                });
            }

            // Force reload with cache busting
            setTimeout(() => {
                window.location.reload();
            }, 100);
        }
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black flex items-center justify-center flex-col p-4 text-center">
                    <h2 className="text-xl font-bold text-white mb-2">Что-то пошло не так</h2>
                    <p className="text-gray-400 mb-6">Возможно, вышло обновление приложения.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-white text-black font-semibold rounded-full active:scale-95 transition-transform"
                    >
                        Обновить страницу
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
