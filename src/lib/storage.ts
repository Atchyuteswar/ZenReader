import localforage from 'localforage';
import { Book } from '../types';

// Configure localforage
localforage.config({
  name: 'ZenReader',
  storeName: 'books',
  description: 'Storage for imported EPUB books'
});

export const storage = {
  async saveBook(book: Book): Promise<void> {
    await localforage.setItem(book.id, book);
  },

  async getBooks(): Promise<Book[]> {
    const books: Book[] = [];
    await localforage.iterate((value: Book) => {
      books.push(value);
    });
    return books.sort((a, b) => b.addedAt - a.addedAt);
  },

  async getBook(id: string): Promise<Book | null> {
    return await localforage.getItem<Book>(id);
  },

  async deleteBook(id: string): Promise<void> {
    await localforage.removeItem(id);
  },
  
  async updateProgress(id: string, cfi: string, percentage?: number): Promise<void> {
    const book = await this.getBook(id);
    if (book) {
      book.progress = cfi;
      if (percentage !== undefined) {
        book.progressPercentage = percentage;
      }
      book.lastRead = Date.now();
      await this.saveBook(book);
    }
  },

  async addHighlight(id: string, highlight: any): Promise<void> {
    const book = await this.getBook(id);
    if (book) {
      book.highlights = [...(book.highlights || []), highlight];
      await this.saveBook(book);
    }
  },

  async removeHighlight(id: string, cfiRange: string): Promise<void> {
    const book = await this.getBook(id);
    if (book && book.highlights) {
      book.highlights = book.highlights.filter(h => h.cfiRange !== cfiRange);
      await this.saveBook(book);
    }
  },

  async addBookmark(id: string, bookmark: any): Promise<void> {
    const book = await this.getBook(id);
    if (book) {
      book.bookmarks = [...(book.bookmarks || []), bookmark];
      await this.saveBook(book);
    }
  },

  async removeBookmark(id: string, cfi: string): Promise<void> {
    const book = await this.getBook(id);
    if (book && book.bookmarks) {
      book.bookmarks = book.bookmarks.filter(b => b.cfi !== cfi);
      await this.saveBook(book);
    }
  }
};
