import { useState } from 'react';
import { Check, Copy, MessageSquareQuote, Trash2 } from 'lucide-react';
import type { Quote } from '@/entities/book/model/types';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { TabSpinner } from './TabSpinner';

const COPIED_MS = 2000;

export function QuotesTab({ quotes, loading, onDelete }: { quotes: Quote[]; loading: boolean; onDelete: (id: string) => void }) {
  const { t } = useLanguage();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), COPIED_MS);
  };

  if (loading) return <TabSpinner />;
  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <MessageSquareQuote size={48} className="text-subtle mb-4" />
        <p className="text-subtle text-center">{t('myBooks.noQuotes')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {quotes.map((quote) => (
        <div key={quote.id} className="bg-surface border border-fg/5 rounded-2xl p-5">
          <p className="text-fg text-sm font-serif italic leading-relaxed mb-4">"{quote.text}"</p>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <div>
              <p className="text-fg font-medium text-xs truncate">{quote.book_title}</p>
              <p className="text-subtle text-[11px] truncate">{quote.book_author}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copy(quote.id, quote.text)}
                className="p-2 text-muted hover:text-fg transition-colors"
                aria-label="Copy quote"
              >
                {copiedId === quote.id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
              <button
                onClick={() => onDelete(quote.id)}
                className="p-2 text-subtle hover:text-red-400 transition-colors"
                aria-label={t('aria.deleteQuote')}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
