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
