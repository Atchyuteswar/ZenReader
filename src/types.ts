export interface Highlight {
  cfiRange: string;
  color: string;
  text?: string;
  created: number;
}

export interface Bookmark {
  cfi: string;
  label: string;
  created: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  cover?: string; // Base64 or URL
  data: ArrayBuffer; // The EPUB file content
  addedAt: number;
  lastRead?: number;
  progress?: string; // CFI location
  progressPercentage?: number; // 0-100
  highlights?: Highlight[];
  bookmarks?: Bookmark[];
}

export type ViewState = 'library' | 'reader';
