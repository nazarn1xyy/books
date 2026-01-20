export interface UserStat {
    id: string;
    name: string;
    avatar: string;
    currentBook: string;
    progress: number;
    lastActive: string;
    totalRead: number;
}

export interface ChartData {
    name: string;
    value: number;
}

export interface GenreStat {
    name: string;
    value: number;
    color: string;
}

export interface SystemStat {
    cpu: number;
    ram: number;
    storage: number;
}

export interface AdminNotification {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    time: string;
    read: boolean;
}

export interface ManagedBook {
    id: string;
    title: string;
    author: string;
    status: 'published' | 'draft' | 'review';
    downloads: number;
}

export const getOverallStats = () => ({
    totalUsers: 142,
    activeNow: 12,
    booksReadTotal: 3840,
    averageTime: '45 мин'
});

export const getPopularBooks = () => [
    { name: '1984', value: 450 },
    { name: 'Мастер и Маргарита', value: 380 },
    { name: 'Дюна', value: 320 },
    { name: 'Атлант расправил плечи', value: 290 },
    { name: 'Три товарища', value: 250 },
];

export const getWeeklyActivity = () => [
    { name: 'Пн', value: 4000 },
    { name: 'Вт', value: 3000 },
    { name: 'Ср', value: 2000 },
    { name: 'Чт', value: 2780 },
    { name: 'Пт', value: 1890 },
    { name: 'Сб', value: 2390 },
    { name: 'Вс', value: 3490 },
];

export const getActiveUsers = (): UserStat[] => [
    {
        id: '1',
        name: 'Анна К.',
        avatar: 'https://i.pravatar.cc/150?u=a',
        currentBook: 'Анна Каренина',
        progress: 45,
        lastActive: '2 мин назад',
        totalRead: 12
    },
    {
        id: '2',
        name: 'Дмитрий В.',
        avatar: 'https://i.pravatar.cc/150?u=d',
        currentBook: 'Метро 2033',
        progress: 89,
        lastActive: '5 мин назад',
        totalRead: 34
    },
    {
        id: '3',
        name: 'Елена М.',
        avatar: 'https://i.pravatar.cc/150?u=e',
        currentBook: 'Гарри Поттер',
        progress: 12,
        lastActive: '15 мин назад',
        totalRead: 5
    },
    {
        id: '4',
        name: 'Александр П.',
        avatar: 'https://i.pravatar.cc/150?u=s',
        currentBook: 'Евгений Онегин',
        progress: 99,
        lastActive: '1 ч назад',
        totalRead: 87
    },
    {
        id: '5',
        name: 'Мария И.',
        avatar: 'https://i.pravatar.cc/150?u=m',
        currentBook: 'Война и Мир',
        progress: 3,
        lastActive: '3 ч назад',
        totalRead: 1
    }
];

export const getGenres = (): GenreStat[] => [
    { name: 'Фантастика', value: 45, color: '#8B5CF6' },
    { name: 'Детективы', value: 25, color: '#3B82F6' },
    { name: 'Классика', value: 20, color: '#10B981' },
    { name: 'Бизнес', value: 10, color: '#F59E0B' },
];

export const getActivityByPeriod = (period: 'day' | 'week' | 'month') => {
    switch (period) {
        case 'day':
            return Array.from({ length: 24 }, (_, i) => ({
                name: `${i}:00`,
                value: Math.floor(Math.random() * 50) + 10
            }));
        case 'week':
            return getWeeklyActivity();
        case 'month':
            return Array.from({ length: 30 }, (_, i) => ({
                name: `${i + 1}`,
                value: Math.floor(Math.random() * 1000) + 500
            }));
    }
};

export const getNotifications = (): AdminNotification[] => [
    { id: '1', type: 'info', message: 'Новый пользователь зарегистрирован', time: '5 мин назад', read: false },
    { id: '2', type: 'warning', message: 'Высокая нагрузка на CPU', time: '15 мин назад', read: false },
    { id: '3', type: 'success', message: 'Бекап базы данных выполнен', time: '1 час назад', read: true },
    { id: '4', type: 'error', message: 'Ошибка загрузки обложки #482', time: '2 часа назад', read: true },
];

export const getManagedBooks = (): ManagedBook[] => [
    { id: '1', title: 'Мастер и Маргарита', author: 'М. Булгаков', status: 'published', downloads: 1240 },
    { id: '2', title: 'Dune', author: 'Frank Herbert', status: 'published', downloads: 890 },
    { id: '3', title: 'Project Hail Mary', author: 'Andy Weir', status: 'review', downloads: 0 },
    { id: '4', title: 'Atomic Habits', author: 'James Clear', status: 'draft', downloads: 0 },
    { id: '5', title: '1984', author: 'George Orwell', status: 'published', downloads: 2100 },
];
