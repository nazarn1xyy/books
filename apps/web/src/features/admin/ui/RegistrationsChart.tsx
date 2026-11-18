import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { AdminStats } from '@libify/shared';

/** Daily registrations (recharts is imported only here; the admin page is a lazy chunk). */
export function RegistrationsChart({ data }: { data: AdminStats['registrationsByDay'] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorRegistrations" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
        <XAxis dataKey="day" stroke="#666" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} interval="preserveStartEnd" />
        <Tooltip
          contentStyle={{ backgroundColor: '#2C2C2E', border: 'none', borderRadius: '12px', color: '#fff' }}
          itemStyle={{ color: '#fff' }}
          cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Регистрации"
          stroke="#3B82F6"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorRegistrations)"
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
