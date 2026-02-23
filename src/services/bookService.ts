import { Book } from '../types';
import { storage } from '../lib/storage';

const API_URL = '/api/books';

export const bookService = {
  async getBooks(token?: string): Promise<Book[]> {
    if (token) {
      const response = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch books');
      return await response.json();
    }
    return storage.getBooks();
  },

  async saveBook(book: Book, file?: File, token?: string): Promise<void> {
    if (token && file) {
      const formData = new FormData();
      formData.append('book', file);
      formData.append('title', book.title);
      formData.append('author', book.author);
      if (book.cover) {
        formData.append('cover', book.cover);
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload book');
      }
      return;
    }
    return storage.saveBook(book);
  },

  async deleteBook(id: string, token?: string): Promise<void> {
    if (token) {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete book');
      return;
    }
    return storage.deleteBook(id);
  },

  async updateProgress(id: string, cfi: string, percentage?: number, token?: string): Promise<void> {
    if (token) {
      await fetch(`${API_URL}/${id}/progress`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ progress: cfi, progressPercentage: percentage })
      });
      return;
    }
    return storage.updateProgress(id, cfi, percentage);
  },

  async addHighlight(id: string, highlight: any, token?: string): Promise<void> {
    // For now, just local storage as backend doesn't support highlights yet
    return storage.addHighlight(id, highlight);
  },

  async removeHighlight(id: string, cfiRange: string, token?: string): Promise<void> {
    return storage.removeHighlight(id, cfiRange);
  },

  async addBookmark(id: string, bookmark: any, token?: string): Promise<void> {
    return storage.addBookmark(id, bookmark);
  },

  async removeBookmark(id: string, cfi: string, token?: string): Promise<void> {
    return storage.removeBookmark(id, cfi);
  }
};
