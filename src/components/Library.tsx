import React, { useEffect, useState } from 'react';
import { Book } from '../types';
import { storage } from '../lib/storage';
import { ImportButton } from './ImportButton';
import { BookOpen, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface LibraryProps {
  onSelectBook: (book: Book) => void;
}

export function Library({ onSelectBook }: LibraryProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const loadedBooks = await storage.getBooks();
      setBooks(loadedBooks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this book?')) {
      await storage.deleteBook(id);
      loadBooks();
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 p-6 md:p-10">
      <header className="flex justify-between items-center mb-10 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-serif font-bold text-stone-900 tracking-tight">Library</h1>
          <p className="text-stone-500 mt-1">Your personal collection</p>
        </div>
        <ImportButton onImportComplete={loadBooks} />
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-stone-300 border-t-stone-600 rounded-full animate-spin"></div>
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-stone-100 max-w-2xl mx-auto">
          <BookOpen className="w-16 h-16 text-stone-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-stone-800 mb-2">No books yet</h3>
          <p className="text-stone-500 mb-6 max-w-md mx-auto">
            Import an EPUB file to start reading. Your library is stored locally on this device.
          </p>
          <div className="inline-block">
            <ImportButton onImportComplete={loadBooks} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          {books.map((book) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative flex flex-col cursor-pointer"
              onClick={() => onSelectBook(book)}
            >
              <div className="aspect-[2/3] bg-stone-200 rounded-lg shadow-md overflow-hidden relative mb-3 transition-transform group-hover:-translate-y-1 group-hover:shadow-xl">
                {book.cover ? (
                  <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-stone-800 text-stone-400 p-4 text-center">
                    <span className="font-serif italic text-sm">{book.title}</span>
                  </div>
                )}
                
                <button
                  onClick={(e) => handleDelete(e, book.id)}
                  className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Delete book"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <h3 className="font-medium text-stone-900 text-sm line-clamp-2 leading-tight mb-1">
                {book.title}
              </h3>
              <p className="text-xs text-stone-500 truncate">{book.author}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
