import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Globe, Loader2, Lock, User } from 'lucide-react';
import { NICKNAME_PATTERN } from '@libify/shared/constants';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LANGUAGES } from '../constants/languages';
import { ApiError } from '../shared/api/ApiError';

const inputClass =
  'w-full h-11 bg-white/[0.04] rounded-xl pl-10 pr-4 text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 border border-white/[0.08] transition-all';

export function Auth() {
  const { login, register } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    if (!showLangDropdown) return;
    const onClick = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) setShowLangDropdown(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLangDropdown(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showLangDropdown]);

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
    <div className="min-h-[100dvh] w-full bg-black flex flex-col items-center justify-center p-4 sm:p-6 relative select-none overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,rgba(120,119,198,0.08),rgba(0,0,0,0))] pointer-events-none" />

      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20" ref={langDropdownRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            aria-expanded={showLangDropdown}
            aria-label={t('aria.switchLanguage')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-neutral-300 text-xs font-medium backdrop-blur-md transition-all active:scale-95"
          >
            <Globe size={14} className="text-neutral-400" aria-hidden="true" />
            <span>
              {currentLang.flag} {currentLang.name}
            </span>
          </button>
          {showLangDropdown && (
            <div className="absolute right-0 mt-2 w-36 bg-[#1C1C1E] rounded-xl border border-white/10 shadow-2xl overflow-hidden z-30 py-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setShowLangDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors text-left ${
                    language === lang.code ? 'bg-white/15 text-white font-semibold' : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-[400px] z-10 my-auto py-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl shadow-xl shadow-black/50 border border-white/10 flex items-center justify-center mb-3 bg-[#18181b] overflow-hidden">
            <img
              src="/AppIcon-512@2x.png"
              alt="Libify"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Libify</h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">{t('auth.tagline')}</p>
        </div>

        <div className="bg-[#141416]/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-white/[0.08] shadow-2xl shadow-black/90">
          <div className="grid grid-cols-2 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06] mb-5" role="tablist">
            {[true, false].map((loginTab) => (
              <button
                key={String(loginTab)}
                type="button"
                role="tab"
                aria-selected={isLogin === loginTab}
                onClick={() => switchMode(loginTab)}
                className={`py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  isLogin === loginTab ? 'bg-white/[0.1] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {loginTab ? t('auth.login') : t('auth.register')}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="nickname" className="text-xs font-medium text-neutral-400 ml-0.5">
                {t('auth.nickname')}
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" aria-hidden="true" />
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
              {!isLogin && <p className="text-[11px] text-neutral-500 ml-0.5">{t('auth.nicknameHint')}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-neutral-400 ml-0.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" aria-hidden="true" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {!isLogin && <p className="text-[11px] text-neutral-500 ml-0.5">{t('auth.passwordHint')}</p>}
            </div>

            {error && (
              <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-white text-black rounded-xl font-semibold text-sm mt-2 hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center shadow-sm"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : isLogin ? t('auth.loginAction') : t('auth.registerAction')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
