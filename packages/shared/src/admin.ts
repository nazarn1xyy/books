export interface AdminStats {
  totalUsers: number;
  activeUsers24h: number;
  activeUsers7d: number;
  totalLibraryBooks: number;
  topBooks: Array<{ bookId: string; title: string; readers: number }>;
  registrationsByDay: Array<{ day: string; count: number }>;
}
