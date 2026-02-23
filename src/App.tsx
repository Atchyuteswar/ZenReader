/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { Book } from './types';

function PrivateRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AppContent() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);

  const handleSelectBook = (book: Book) => {
    setCurrentBook(book);
  };

  const handleBackToLibrary = () => {
    setCurrentBook(null);
  };

  return (
    <div className="antialiased text-stone-900 bg-stone-50 min-h-screen font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              {currentBook ? (
                <Reader book={currentBook} onBack={handleBackToLibrary} />
              ) : (
                <Library onSelectBook={handleSelectBook} />
              )}
            </PrivateRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}
