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
  series?: string;
  seriesNumber?: number;
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
  theme?: 'light' | 'dark' | 'sepia' | 'oled';
}

export interface AppState {
  myBooks: string[];
  bookMetadata: Record<string, Book>;
  readingProgress: Record<string, ReadingProgress>;
  settings: UserSettings;
  pendingDeletions?: string[];
  pendingUploads?: string[];
}

export interface Quote {
  id: string;
  user_id: string;
  book_id: string;
  book_title?: string;
  book_author?: string;
  text: string;
  note?: string;
  color?: string;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  book_id: string;
  book_title?: string;
  book_author?: string;
  book_cover?: string;
  created_at: string;
}
