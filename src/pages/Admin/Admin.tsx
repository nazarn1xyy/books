import { motion } from 'framer-motion';
import { Users, BookOpen, Clock, Activity, BarChart2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getOverallStats, getActiveUsers, getPopularBooks, getWeeklyActivity } from '../../services/mockStats';

export function Admin() {
    const stats = getOverallStats();
    const activeUsers = getActiveUsers();
    const popularBooks = getPopularBooks();
    const weeklyActivity = getWeeklyActivity();

    return (
        <div className="min-h-screen bg-black text-white pb-24 pt-[env(safe-area-inset-top)]">
            <header className="px-5 py-6">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-3xl font-bold">Админ панель</h1>
                    <div className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Online
                    </div>
                </div>
                <p className="text-gray-500">Статистика и метрики (Демо версия)</p>
            </header>

            <main className="px-5 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <StatCard
                        icon={<Users size={20} className="text-blue-400" />}
                        label="Всего пользователей"
                        value={stats.totalUsers.toString()}
                        trend="+12%"
                    />
                    <StatCard
                        icon={<Activity size={20} className="text-green-400" />}
                        label="Активны сейчас"
                        value={stats.activeNow.toString()}
                        trend="+5"
                    />
                    <StatCard
                        icon={<BookOpen size={20} className="text-purple-400" />}
                        label="Книг прочитано"
                        value={stats.booksReadTotal.toString()}
                        trend="+124"
                    />
                    <StatCard
                        icon={<Clock size={20} className="text-orange-400" />}
                        label="Ср. время чтения"
                        value={stats.averageTime}
                        trend="稳定"
                    />
                </div>

                {/* Activity Chart */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart2 size={20} className="text-gray-400" />
                        <h2 className="text-lg font-bold">Активность за неделю</h2>
                    </div>
                    <div className="bg-[#1C1C1E] rounded-3xl p-4 h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weeklyActivity}>
                                <defs>
                                    <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#2C2C2E', border: 'none', borderRadius: '12px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorActivity)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Active Users */}
                <section>
                    <h2 className="text-lg font-bold mb-4">Читают прямо сейчас</h2>
                    <div className="space-y-3">
                        {activeUsers.map((user, i) => (
                            <motion.div
                                key={user.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-[#1C1C1E] p-4 rounded-2xl flex items-center gap-4"
                            >
                                <div className="relative">
                                    <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1C1C1E] rounded-full" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-medium text-white truncate">{user.name}</h3>
                                        <span className="text-xs text-gray-500">{user.lastActive}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 truncate mb-2">Читает: {user.currentBook}</p>
                                    <div className="h-1.5 bg-[#2C2C2E] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${user.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Popular Books */}
                <section>
                    <h2 className="text-lg font-bold mb-4">Топ книг</h2>
                    <div className="bg-[#1C1C1E] rounded-3xl p-5">
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={popularBooks} layout="vertical" barSize={20}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} stroke="#999" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#2C2C2E', border: 'none', borderRadius: '8px' }}
                                />
                                <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} background={{ fill: '#2C2C2E' }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            </main>
        </div>
    );
}

function StatCard({ icon, label, value, trend }: { icon: React.ReactNode, label: string, value: string, trend: string }) {
    return (
        <div className="bg-[#1C1C1E] p-4 rounded-2xl flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <div className="p-2 bg-white/5 rounded-xl">
                    {icon}
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-lg ${trend.includes('+') ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-400'}`}>
                    {trend}
                </span>
            </div>
            <div>
                <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
                <p className="text-xs text-gray-500">{label}</p>
            </div>
        </div>
    );
}
