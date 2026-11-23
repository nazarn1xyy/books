import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: LucideIcon;
  text: string;
  /** Optional call to action, e.g. "Find a book" → /search. */
  action?: { label: string; to: string };
}

/** Icon, one line of explanation and an optional action for screens without data. */
export function EmptyState({ icon: Icon, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={48} className="text-subtle mb-4" aria-hidden="true" />
      <p className="text-subtle">{text}</p>
      {action && (
        <Link
          to={action.to}
          className="mt-5 inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-accent text-on-accent text-sm font-semibold active:scale-95 transition-transform"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
