import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Mail, Lock, Loader2, CheckCircle, Eye, EyeOff, Globe } from 'lucide-react';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useLanguage, type Language } from '../contexts/LanguageContext';

const LANGUAGES: { code: Language; name: string; flag: string }[] = [
    { code: 'uk', name: 'UA', flag: '🇺🇦' },
    { code: 'ru', name: 'RU', flag: '🇷🇺' },
    { code: 'en', name: 'EN', flag: '🇬🇧' },
];

export function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [nickname, setNickname] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showLangDropdown, setShowLangDropdown] = useState(false);

    const { isKeyboardOpen } = useKeyboardHeight();
    const { language, setLanguage, t } = useLanguage();

    const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError(t('auth.email') + ' required');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
                redirectTo: `${window.location.origin}/auth`,
            });
            if (resetError) throw resetError;
            setSuccessMessage(t('auth.resetLinkSent', { email: trimmedEmail }));
        } catch (err: unknown) {
            const errorObj = err as { message?: string };
            setError(errorObj.message || t('errors.serverUnavailable'));
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        const trimmedEmail = email.trim();

        try {
            if (isLogin) {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: trimmedEmail,
                    password,
                });
                if (signInError) throw signInError;
            } else {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email: trimmedEmail,
                    password,
                    options: {
                        data: {
                            nickname: nickname.trim(),
                        },
                    },
                });

                if (signUpError) throw signUpError;

                if (data.user && !data.session) {
                    setSuccessMessage(t('auth.accountCreated', { email: trimmedEmail }));
                    setIsLogin(true);
                } else if (data.session) {
                    // Auto-login happened
                } else {
                    setIsLogin(true);
                }
            }
        } catch (err: unknown) {
            console.error('Auth error:', err);
            const errorObj = err as { message?: string };
            let message = errorObj?.message || t('common.error');

            const lower = (message || '').toLowerCase();
            if (lower.includes('load failed') || lower.includes('failed to fetch')) {
                message = language === 'en'
                    ? 'Connection error. Check your internet connection.'
                    : language === 'uk'
                    ? 'Помилка з’єднання. Перевірте інтернет або вимкніть VPN.'
                    : 'Ошибка соединения. Проверьте интернет или отключите VPN.';
            } else if (lower.includes('invalid login credentials')) {
                message = language === 'en'
                    ? 'Invalid email or password.'
                    : language === 'uk'
                    ? 'Невірний email або пароль.'
                    : 'Неверный email или пароль.';
            } else if (lower.includes('email not confirmed')) {
                message = language === 'en'
                    ? 'Email is not confirmed. Please check your inbox/spam folder.'
                    : language === 'uk'
                    ? 'Email не підтверджено. Перевірте пошту та папку спам.'
                    : 'Email не подтверждён. Проверьте почту и папку спам.';
            } else if (lower.includes('user already registered')) {
                message = language === 'en'
                    ? 'This email is already registered. Please log in.'
                    : language === 'uk'
                    ? 'Цей email вже зареєстровано. Спробуйте увійти.'
                    : 'Этот email уже зарегистрирован. Попробуйте войти.';
            }

            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen w-full bg-black flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none"
            style={{
                position: isKeyboardOpen ? 'fixed' : 'relative',
                height: isKeyboardOpen ? '100vh' : 'auto',
                overflow: isKeyboardOpen ? 'hidden' : 'visible'
            }}
        >
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,rgba(120,119,198,0.08),rgba(0,0,0,0))] pointer-events-none" />

            {/* Language Selector Top Right */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowLangDropdown(!showLangDropdown)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-neutral-300 text-xs font-medium backdrop-blur-md transition-all active:scale-95"
                    >
                        <Globe size={14} className="text-neutral-400" />
                        <span>{currentLang.flag} {currentLang.name}</span>
                    </button>

                    {showLangDropdown && (
                        <div className="absolute right-0 mt-2 w-32 bg-[#1C1C1E] rounded-xl border border-white/10 shadow-2xl overflow-hidden z-30 py-1">
                            {LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    type="button"
                                    onClick={() => {
                                        setLanguage(lang.code);
                                        setShowLangDropdown(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors text-left ${
                                        language === lang.code
                                            ? 'bg-white/15 text-white'
                                            : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <span>{lang.flag}</span>
                                    <span>{lang.code === 'uk' ? 'Українська' : lang.code === 'ru' ? 'Русский' : 'English'}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full max-w-[400px] z-10 my-auto">
                {/* Brand Header */}
                <div className="text-center mb-6">
                    <div className="mx-auto w-16 h-16 rounded-2xl shadow-xl shadow-black/50 border border-white/10 flex items-center justify-center mb-3 bg-[#18181b] overflow-hidden">
                        <img
                            src="/AppIcon-512@2x.png"
                            alt="Libify"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                // Fallback if image fails to load
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Libify</h1>
                    <p className="text-xs sm:text-sm text-neutral-400 mt-1">{t('auth.tagline')}</p>
                </div>

                {/* Auth Card */}
                <div className="bg-[#141416]/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-white/[0.08] shadow-2xl shadow-black/90">
                    {/* Success Message */}
                    {successMessage && (
                        <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5">
                            <CheckCircle size={17} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                            <p className="text-emerald-400 text-xs sm:text-sm leading-relaxed">{successMessage}</p>
                        </div>
                    )}

                    {isForgotPassword ? (
                        /* Forgot Password Form */
                        <form onSubmit={handleForgotPassword} className="space-y-4">
                            <div>
                                <h2 className="text-white font-semibold text-base mb-1">{t('auth.resetPassword')}</h2>
                                <p className="text-neutral-400 text-xs">{t('auth.resetPasswordDesc')}</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-neutral-400 ml-0.5">{t('auth.email')}</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                                    <input
                                        type="email"
                                        required
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={t('auth.emailPlaceholder')}
                                        className="w-full h-11 bg-white/[0.04] rounded-xl pl-10 pr-4 text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 border border-white/[0.08] transition-all"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center shadow-sm"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : t('auth.sendResetLink')}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setIsForgotPassword(false); setError(null); setSuccessMessage(null); }}
                                className="w-full text-neutral-400 text-xs hover:text-white transition-colors py-1.5 text-center font-medium"
                            >
                                ← {t('auth.backToLogin')}
                            </button>
                        </form>
                    ) : (
                        <>
                            {/* Segmented Control Tabs */}
                            <div className="grid grid-cols-2 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06] mb-5">
                                <button
                                    type="button"
                                    onClick={() => { setIsLogin(true); setError(null); setSuccessMessage(null); }}
                                    className={`py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                                        isLogin
                                            ? 'bg-white text-black shadow-sm font-semibold'
                                            : 'text-neutral-400 hover:text-white'
                                    }`}
                                >
                                    {t('auth.login')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsLogin(false); setError(null); setSuccessMessage(null); }}
                                    className={`py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                                        !isLogin
                                            ? 'bg-white text-black shadow-sm font-semibold'
                                            : 'text-neutral-400 hover:text-white'
                                    }`}
                                >
                                    {t('auth.register')}
                                </button>
                            </div>

                            <form onSubmit={handleAuth} className="space-y-4">
                                {!isLogin && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-neutral-400 ml-0.5">{t('auth.nickname')}</label>
                                        <div className="relative">
                                            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                                            <input
                                                type="text"
                                                required={!isLogin}
                                                autoComplete="username"
                                                value={nickname}
                                                onChange={(e) => setNickname(e.target.value)}
                                                placeholder={t('auth.nicknamePlaceholder')}
                                                className="w-full h-11 bg-white/[0.04] rounded-xl pl-10 pr-4 text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 border border-white/[0.08] transition-all"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-neutral-400 ml-0.5">{t('auth.email')}</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                                        <input
                                            type="email"
                                            required
                                            autoComplete="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t('auth.emailPlaceholder')}
                                            className="w-full h-11 bg-white/[0.04] rounded-xl pl-10 pr-4 text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 border border-white/[0.08] transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between ml-0.5">
                                        <label className="text-xs font-medium text-neutral-400">{t('auth.password')}</label>
                                        {isLogin && (
                                            <button
                                                type="button"
                                                onClick={() => { setIsForgotPassword(true); setError(null); setSuccessMessage(null); }}
                                                className="text-[11px] text-neutral-400 hover:text-white transition-colors"
                                            >
                                                {t('auth.forgotPassword')}
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder={t('auth.passwordPlaceholder')}
                                            minLength={6}
                                            className="w-full h-11 bg-white/[0.04] rounded-xl pl-10 pr-10 text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 border border-white/[0.08] transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-11 bg-white text-black rounded-xl font-semibold text-sm mt-2 hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center shadow-sm"
                                >
                                    {loading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        isLogin ? t('auth.loginAction') : t('auth.registerAction')
                                    )}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
