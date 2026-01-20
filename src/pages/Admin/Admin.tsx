import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, BookOpen, Clock, Activity, BarChart2, PieChart as PieChartIcon, Bell, Cpu, HardDrive, Search, Filter, MoreVertical, Check, X as XIcon, ChevronRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { getOverallStats, getActiveUsers, getPopularBooks, getActivityByPeriod, getGenres, getNotifications, getManagedBooks, type UserStat, type AdminNotification, type ManagedBook } from '../../services/mockStats';

export function Admin() {
    const stats = getOverallStats();
    const activeUsers = getActiveUsers();
    const popularBooks = getPopularBooks();
    const genres = getGenres();
    const notifications = getNotifications();
    const managedBooks = getManagedBooks();

    const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
    const [activityData, setActivityData] = useState(getActivityByPeriod('week'));
    const [showNotifications, setShowNotifications] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserStat | null>(null);
    const [systemStats, setSystemStats] = useState({ cpu: 45, ram: 62 });

    // Simulate system stats updates
    useEffect(() => {
        const interval = setInterval(() => {
            setSystemStats({
                cpu: Math.min(100, Math.max(10, Math.floor(Math.random() * 40) + 30)),
                ram: Math.min(100, Math.max(20, Math.floor(Math.random() * 20) + 50))
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Update charts on period change
    useEffect(() => {
        setActivityData(getActivityByPeriod(period));
    }, [period]);

    return (
        <div className="min-h-screen bg-black text-white pb-24 pt-[env(safe-area-inset-top)] overflow-x-hidden">
            <header className="px-5 py-6 sticky top-0 bg-black/80 backdrop-blur-md z-30">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold">Панель</h1>
                        <p className="text-xs text-gray-500 font-mono mt-1">v.2.4.0 • PRO</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* System Mini-Stats */}
                        <div className="hidden md:flex items-center gap-3 bg-[#1C1C1E] px-3 py-1.5 rounded-lg border border-white/5">
                            <div className="flex items-center gap-2">
                                <Cpu size={14} className="text-blue-400" />
                                <span className="text-xs font-mono">{systemStats.cpu}%</span>
                            </div>
                            <div className="w-[1px] h-3 bg-white/10" />
                            <div className="flex items-center gap-2">
                                <HardDrive size={14} className="text-purple-400" />
                                <span className="text-xs font-mono">{systemStats.ram}%</span>
                            </div>
                        </div>

                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2 bg-[#1C1C1E] rounded-full hover:bg-white/10 transition-colors relative"
                            >
                                <Bell size={20} className={showNotifications ? 'text-white' : 'text-gray-400'} />
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black" />
                            </button>

                            <AnimatePresence>
                                {showNotifications && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-12 w-80 bg-[#1C1C1E] rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50 p-2"
                                    >
                                        <h3 className="text-sm font-semibold px-4 py-2 text-gray-400">Уведомления</h3>
                                        {notifications.map(n => (
                                            <div key={n.id} className="p-3 hover:bg-white/5 rounded-xl transition-colors flex gap-3">
                                                <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${n.type === 'error' ? 'bg-red-500' :
                                                        n.type === 'warning' ? 'bg-yellow-500' :
                                                            n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                                                    }`} />
                                                <div>
                                                    <p className="text-sm text-white leading-snug">{n.message}</p>
                                                    <span className="text-xs text-gray-500 mt-1 block">{n.time}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Mobile System Stats */}
                <div className="md:hidden grid grid-cols-2 gap-2 mb-4">
                    <div className="flex items-center justify-between bg-[#1C1C1E] px-3 py-2 rounded-lg border border-white/5">
                        <span className="text-xs text-gray-400">CPU Load</span>
                        <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-blue-500"
                                    animate={{ width: `${systemStats.cpu}%` }}
                                />
                            </div>
                            <span className="text-xs font-mono">{systemStats.cpu}%</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between bg-[#1C1C1E] px-3 py-2 rounded-lg border border-white/5">
                        <span className="text-xs text-gray-400">RAM Usage</span>
                        <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-purple-500"
                                    animate={{ width: `${systemStats.ram}%` }}
                                />
                            </div>
                            <span className="text-xs font-mono">{systemStats.ram}%</span>
                        </div>
                    </div>
                </div>

                {/* Period Selector */}
                <div className="flex bg-[#1C1C1E] p-1 rounded-xl">
                    {(['day', 'week', 'month'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${period === p ? 'bg-[#2C2C2E] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {p === 'day' ? '24ч' : p === 'week' ? 'Неделя' : 'Месяц'}
                        </button>
                    ))}
                </div>
            </header>

            <main className="px-5 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                        icon={<Users size={20} className="text-blue-400" />}
                        label="Пользователи"
                        value={stats.totalUsers.toString()}
                        trend="+12%"
                    />
                    <StatCard
                        icon={<Activity size={20} className="text-green-400" />}
                        label="Сейчас читают"
                        value={stats.activeNow.toString()}
                        trend="+5"
                    />
                    <StatCard
                        icon={<BookOpen size={20} className="text-purple-400" />}
                        label="Книги"
                        value={stats.booksReadTotal.toString()}
                        trend="+124"
                    />
                    <StatCard
                        icon={<Clock size={20} className="text-orange-400" />}
                        label="Время чтения"
                        value={stats.averageTime}
                        trend="稳定"
                    />
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Activity Chart */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart2 size={20} className="text-gray-400" />
                            <h2 className="text-lg font-bold">Активность</h2>
                        </div>
                        <div className="bg-[#1C1C1E] rounded-3xl p-4 h-64 border border-white/5">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activityData}>
                                    <defs>
                                        <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                                    <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} interval="preserveStartEnd" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#2C2C2E', border: 'none', borderRadius: '12px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                        cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#3B82F6"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorActivity)"
                                        animationDuration={1000}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {/* Genre Distribution */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <PieChartIcon size={20} className="text-gray-400" />
                            <h2 className="text-lg font-bold">Жанры</h2>
                        </div>
                        <div className="bg-[#1C1C1E] rounded-3xl p-4 h-64 border border-white/5 flex items-center relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={genres}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {genres.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.5)" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#2C2C2E', border: 'none', borderRadius: '12px', color: '#fff' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Legend */}
                            <div className="absolute top-4 right-4 flex flex-col gap-2">
                                {genres.map(g => (
                                    <div key={g.name} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                                        <span className="text-xs text-gray-400">{g.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>

                {/* Management Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Active Users List */}
                    <section>
                        <h2 className="text-lg font-bold mb-4">Пользователи Online</h2>
                        <div className="space-y-3">
                            {activeUsers.map((user, i) => (
                                <motion.div
                                    key={user.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    onClick={() => setSelectedUser(user)}
                                    className="bg-[#1C1C1E] p-4 rounded-2xl flex items-center gap-4 border border-white/5 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                    <div className="relative">
                                        <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1C1C1E] rounded-full animate-pulse" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-medium text-white truncate">{user.name}</h3>
                                            <ChevronRight size={16} className="text-gray-600" />
                                        </div>
                                        <p className="text-xs text-gray-400 truncate mb-2">{user.currentBook}</p>
                                        <div className="h-1.5 bg-[#2C2C2E] rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-blue-500 rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${user.progress}%` }}
                                                transition={{ duration: 1, delay: 0.5 }}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </section>

                    {/* Books Management */}
                    <section>
                        <h2 className="text-lg font-bold mb-4">Управление книгами</h2>
                        <div className="bg-[#1C1C1E] rounded-3xl overflow-hidden border border-white/5">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#2C2C2E] text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Название</th>
                                        <th className="px-4 py-3 font-medium text-right">Статус</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {managedBooks.map((book) => (
                                        <tr key={book.id}>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-white">{book.title}</div>
                                                <div className="text-xs text-gray-500">{book.author}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${book.status === 'published' ? 'bg-green-500/10 text-green-500' :
                                                        book.status === 'review' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-gray-500/10 text-gray-400'
                                                    }`}>
                                                    {book.status === 'published' ? 'Опубликован' : book.status === 'review' ? 'На проверке' : 'Черновик'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button className="w-full py-3 text-center text-sm text-blue-400 font-medium hover:bg-white/5 transition-colors">
                                Показать все книги
                            </button>
                        </div>
                    </section>
                </div>
            </main>

            {/* User Details Modal */}
            <AnimatePresence>
                {selectedUser && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedUser(null)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-[#1C1C1E] w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 pointer-events-auto relative z-50 border-t border-white/10"
                        >
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="absolute top-4 right-4 p-2 bg-[#2C2C2E] rounded-full text-gray-400"
                            >
                                <XIcon size={20} />
                            </button>

                            <div className="flex flex-col items-center mb-6">
                                <img src={selectedUser.avatar} className="w-20 h-20 rounded-full mb-3 border-4 border-[#2C2C2E]" />
                                <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                                <p className="text-gray-500 text-sm">Online • {selectedUser.lastActive}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-[#2C2C2E] p-3 rounded-xl text-center">
                                    <div className="text-2xl font-bold text-white">{selectedUser.totalRead}</div>
                                    <div className="text-xs text-gray-400">Книг прочитано</div>
                                </div>
                                <div className="bg-[#2C2C2E] p-3 rounded-xl text-center">
                                    <div className="text-2xl font-bold text-green-500">Top 5%</div>
                                    <div className="text-xs text-gray-400">Активность</div>
                                </div>
                            </div>

                            <h4 className="font-semibold mb-3">Текущая книга</h4>
                            <div className="bg-[#2C2C2E] p-4 rounded-xl flex gap-4 items-center">
                                <div className="w-12 h-16 bg-gray-700 rounded-md flex-shrink-0" /> {/* Mock cover */}
                                <div className="flex-1">
                                    <div className="font-medium line-clamp-1">{selectedUser.currentBook}</div>
                                    <div className="text-sm text-gray-400 mb-2">Прогресс</div>
                                    <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${selectedUser.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button className="w-full mt-6 bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors">
                                Написать сообщение
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function StatCard({ icon, label, value, trend }: { icon: React.ReactNode, label: string, value: string, trend: string }) {
    return (
        <div className="bg-[#1C1C1E] p-4 rounded-2xl flex flex-col justify-between h-32 border border-white/5">
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
