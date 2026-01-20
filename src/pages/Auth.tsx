import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;

        if (isLogin) {
            login(username);
        } else {
            register(username);
        }
        navigate('/');
    };

    return (
        <div className="min-h-[100dvh] bg-black flex flex-col justify-center p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="w-full max-w-md mx-auto bg-[#1C1C1E] rounded-[2rem] p-8 shadow-2xl border border-white/5 animate-slide-up">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Libify</h1>
                    <p className="text-gray-400 text-sm">
                        {isLogin ? 'С возвращением!' : 'Создайте аккаунт, чтобы начать читать'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Ваше имя"
                            className="w-full bg-[#2C2C2E] text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/20 transition-all font-medium placeholder:text-gray-500 text-[16px] appearance-none"
                            autoFocus
                            autoComplete="off"
                            autoCapitalize="sentences"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!username.trim()}
                        className="w-full bg-white text-black font-bold py-4 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
                    >
                        {isLogin ? 'Войти' : 'Зарегистрироваться'}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-sm text-gray-500 hover:text-white transition-colors py-2 px-4"
                    >
                        {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
                    </button>
                </div>
            </div>

            {/* Footer / Branding safe area buffer */}
            <div className="mt-8 text-center opacity-30 text-xs">
                <p>Book Library App</p>
            </div>
        </div>
    );
}
