import React, { useRef, useState } from 'react';
import ePub from 'epubjs';
import { v4 as uuidv4 } from 'uuid';
import { Upload, Loader2 } from 'lucide-react';
import { storage } from '../lib/storage';
import { Book } from '../types';

interface ImportButtonProps {
  onImportComplete: () => void;
}

export function ImportButton({ onImportComplete }: ImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const book = ePub(arrayBuffer);
      
      // Wait for book to be ready
      await book.ready;
      
      const metadata = await book.loaded.metadata;
      const coverUrl = await book.coverUrl();
      
      // Convert cover blob URL to base64 if possible, or just store the blob if we can persist it
      // Actually, blob URLs are revoked. We need to fetch the cover blob and convert to base64
      let coverBase64 = '';
      if (coverUrl) {
        const response = await fetch(coverUrl);
        const blob = await response.blob();
        coverBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const newBook: Book = {
        id: uuidv4(),
        title: metadata.title || file.name.replace('.epub', ''),
        author: metadata.creator || 'Unknown Author',
        cover: coverBase64,
        data: arrayBuffer,
        addedAt: Date.now(),
      };

      await storage.saveBook(newBook);
      onImportComplete();
      
    } catch (error) {
      console.error('Failed to import book:', error);
      alert('Failed to import EPUB. Please try another file.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        type="file"
        accept=".epub"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Upload className="w-5 h-5" />
        )}
        <span className="font-medium">Import EPUB</span>
      </button>
    </>
  );
}
