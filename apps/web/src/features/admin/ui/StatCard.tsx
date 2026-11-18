import type { ReactNode } from 'react';

export function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#1C1C1E] p-4 rounded-2xl flex flex-col justify-between h-32 border border-white/5">
      <div className="flex justify-between items-start">
        <div className="p-2 bg-white/5 rounded-xl">{icon}</div>
      </div>
      <div>
        <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
