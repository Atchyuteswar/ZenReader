import ePub from 'epubjs';
import { v4 as uuidv4 } from 'uuid';
import { Book } from '../types';
import { bookService } from './bookService';

export async function importEpub(file: File, token?: string): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);
  
  await book.ready;
  
  const metadata = await book.loaded.metadata;
  const coverUrl = await book.coverUrl();
  
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

  await bookService.saveBook(newBook, file, token);
}
