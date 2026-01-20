import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, User, Mail, Lock, Loader2 } from 'lucide-react';

export function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            } else {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            nickname,
                        },
                    },
                });
                if (signUpError) throw signUpError;
                // Auto login or success message
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            setError(err.message || 'Ошибка авторизации');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-md z-10">
                <div className="text-center mb-10">
                    <div className="mx-auto w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-xl">
                        <BookOpen size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Библиотека</h1>
                    <p className="text-gray-400">Твой личный книжный мир</p>
                </div>

                <div className="bg-[#1C1C1E]/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                    <div className="flex gap-4 mb-8 bg-black/20 p-1 rounded-xl">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${isLogin
                                ? 'bg-white text-black shadow-lg'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Вход
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${!isLogin
                                ? 'bg-white text-black shadow-lg'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Регистрация
                        </button>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400 ml-1">Никнейм</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="text"
                                        required={!isLogin}
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        placeholder="Придумайте никнейм"
                                        className="w-full h-12 bg-black/40 rounded-xl pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all border border-white/5 focus:border-white/10"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-400 ml-1">Email</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="example@mail.com"
                                    className="w-full h-12 bg-black/40 rounded-xl pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all border border-white/5 focus:border-white/10"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-400 ml-1">Пароль</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    minLength={6}
                                    className="w-full h-12 bg-black/40 rounded-xl pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all border border-white/5 focus:border-white/10"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-white text-black rounded-xl font-bold mt-2 hover:bg-gray-100 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center shadow-lg shadow-white/5"
                        >
                            {loading ? (
                                <Loader2 size={24} className="animate-spin" />
                            ) : (
                                isLogin ? 'Войти' : 'Создать аккаунт'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
