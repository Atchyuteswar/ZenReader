/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { Book, ViewState } from './types';

export default function App() {
  const [view, setView] = useState<ViewState>('library');
  const [currentBook, setCurrentBook] = useState<Book | null>(null);

  const handleSelectBook = (book: Book) => {
    setCurrentBook(book);
    setView('reader');
  };

  const handleBackToLibrary = () => {
    setView('library');
    setCurrentBook(null);
  };

  return (
    <div className="antialiased text-stone-900 bg-stone-50 min-h-screen font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {view === 'library' && (
        <Library onSelectBook={handleSelectBook} />
      )}
      
      {view === 'reader' && currentBook && (
        <Reader book={currentBook} onBack={handleBackToLibrary} />
      )}
    </div>
  );
}
