import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from './db';
import { authenticateToken } from './auth';

const router = express.Router();
const uploadDir = path.resolve('data/uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Upload Book
router.post('/', authenticateToken, upload.single('book'), (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { title, author, cover } = req.body;
  const id = uuidv4();
  const filePath = req.file.path;
  const addedAt = Date.now();

  try {
    const stmt = db.prepare('INSERT INTO books (id, userId, title, author, cover, filePath, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(id, req.user.id, title, author, cover, filePath, addedAt);
    res.json({ id, title, author, cover, addedAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save book metadata' });
  }
});

// List Books
router.get('/', authenticateToken, (req: any, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM books WHERE userId = ? ORDER BY addedAt DESC');
    const books = stmt.all(req.user.id);
    res.json(books);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Delete Book
router.delete('/:id', authenticateToken, (req: any, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('SELECT * FROM books WHERE id = ? AND userId = ?');
    const book: any = stmt.get(id, req.user.id);

    if (!book) return res.status(404).json({ error: 'Book not found' });

    fs.unlinkSync(book.filePath);
    const deleteStmt = db.prepare('DELETE FROM books WHERE id = ?');
    deleteStmt.run(id);

    res.json({ message: 'Book deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// Update Progress
router.put('/:id/progress', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const { progress, progressPercentage } = req.body;

  try {
    const stmt = db.prepare('UPDATE books SET progress = ?, progressPercentage = ?, lastRead = ? WHERE id = ? AND userId = ?');
    stmt.run(progress, progressPercentage, Date.now(), id, req.user.id);
    res.json({ message: 'Progress updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Download Book
router.get('/:id/download', authenticateToken, (req: any, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('SELECT * FROM books WHERE id = ? AND userId = ?');
    const book: any = stmt.get(id, req.user.id);

    if (!book) return res.status(404).json({ error: 'Book not found' });

    res.download(book.filePath, `${book.title}.epub`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to download book' });
  }
});

export default router;
