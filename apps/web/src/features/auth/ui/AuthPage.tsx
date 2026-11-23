import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import { NICKNAME_PATTERN } from '@libify/shared/constants';
import { useAuth } from '../model/AuthContext';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { ApiError } from '@/shared/api/ApiError';

const inputClass =
  'w-full h-11 bg-fg/[0.04] rounded-xl pl-10 pr-4 text-fg text-base sm:text-sm placeholder-subtle focus:outline-none focus:ring-1 focus:ring-fg/20 focus:border-fg/20 border border-fg/[0.08] transition-all';

export function AuthPage() {
  const { login, register } = useAuth();
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messageFor = (err: unknown): string => {
    if (!(err instanceof ApiError)) return t('errors.unknownAuthError');
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
        return t('errors.invalidCredentials');
      case 'NICKNAME_TAKEN':
        return t('errors.userAlreadyExists');
      case 'RATE_LIMITED':
        return t('errors.tooManyAttempts');
      case 'NETWORK':
      case 'TIMEOUT':
        return t('errors.connectionError');
      default:
        return t('errors.unknownAuthError');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nick = nickname.trim();
    if (!isLogin) {
      if (!NICKNAME_PATTERN.test(nick)) return setError(t('errors.invalidNickname'));
      if (password.length < 8) return setError(t('errors.passwordTooShort'));
    }
    setLoading(true);
    setError(null);
    try {
      if (isLogin) await login({ nickname: nick, password });
      else await register({ nickname: nick, password });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (login: boolean) => {
    setIsLogin(login);
    setError(null);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-app flex flex-col items-center justify-center p-4 sm:p-6 relative select-none overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,rgba(120,119,198,0.08),rgba(0,0,0,0))] pointer-events-none" />

      <div className="w-full max-w-[400px] z-10 my-auto py-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl shadow-xl shadow-black/50 border border-line flex items-center justify-center mb-3 bg-surface overflow-hidden">
            <img
              src="/logo-192.png"
              alt="Libify"
              width={64}
              height={64}
              fetchPriority="high"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-fg tracking-tight">Libify</h1>
          <p className="text-xs sm:text-sm text-muted mt-1">{t('auth.tagline')}</p>
        </div>

        <div className="bg-surface/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-fg/[0.08] shadow-2xl shadow-black/90">
          <div className="grid grid-cols-2 p-1 bg-fg/[0.04] rounded-xl border border-fg/[0.06] mb-5" role="tablist">
            {[true, false].map((loginTab) => (
              <button
                key={String(loginTab)}
                type="button"
                role="tab"
                aria-selected={isLogin === loginTab}
                onClick={() => switchMode(loginTab)}
                className={`py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  isLogin === loginTab ? 'bg-fg/[0.1] text-fg shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                {loginTab ? t('auth.login') : t('auth.register')}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="nickname" className="text-xs font-medium text-muted ml-0.5">
                {t('auth.nickname')}
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" aria-hidden="true" />
                <input
                  id="nickname"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t('auth.nicknamePlaceholder')}
                  className={inputClass}
                />
              </div>
              {!isLogin && <p className="text-[11px] text-subtle ml-0.5">{t('auth.nicknameHint')}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-muted ml-0.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('aria.hidePassword') : t('aria.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-muted transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {!isLogin && <p className="text-[11px] text-subtle ml-0.5">{t('auth.passwordHint')}</p>}
            </div>

            {error && (
              <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-accent text-on-accent rounded-xl font-semibold text-sm mt-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center shadow-sm"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : isLogin ? t('auth.loginAction') : t('auth.registerAction')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
