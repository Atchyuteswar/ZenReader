import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { importEpub } from '../services/importService';

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
      await importEpub(file);
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
