import { Component, ErrorInfo, ReactNode } from "react";

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

        // Check if it's a chunk load error (deployment update)
        if (error.message.includes('Loading chunk') || error.message.includes('Importing a module script failed')) {
            console.log('Chunk load error detected, reloading page...');
            window.location.reload();
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
