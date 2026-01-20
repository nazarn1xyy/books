export interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  description: string;
  genre: string;
  pages?: number;
  content?: string[];
  contentUrl?: string;
  format?: 'fb2' | 'pdf';
}

export interface ReadingProgress {
  bookId: string;
  currentPage: number;
  totalPages: number;
  lastRead: number;
  scrollPercentage?: number;
}

export interface UserSettings {
  fontSize: number;
  brightness: number;
}

export interface AppState {
  myBooks: string[];
  bookMetadata: Record<string, Book>;
  readingProgress: Record<string, ReadingProgress>;
  settings: UserSettings;
}
