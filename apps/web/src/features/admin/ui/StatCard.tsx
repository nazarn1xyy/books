import type { ReactNode } from 'react';

export function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface p-4 rounded-2xl flex flex-col justify-between h-32 border border-fg/5">
      <div className="flex justify-between items-start">
        <div className="p-2 bg-fg/5 rounded-xl">{icon}</div>
      </div>
      <div>
        <h3 className="text-2xl font-bold text-fg mb-1">{value}</h3>
        <p className="text-xs text-subtle">{label}</p>
      </div>
    </div>
  );
}
