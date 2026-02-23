import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import db from './db';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

// Middleware to verify token
export const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Signup
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const createdAt = Date.now();

    const stmt = db.prepare('INSERT INTO users (id, email, password, name, createdAt) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, email, hashedPassword, name || email.split('@')[0], createdAt);

    const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id, email, name } });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user: any = stmt.get(email);

    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    if (!user.password) return res.status(400).json({ error: 'Please login with Google' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google Login
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Credential required' });

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(400).json({ error: 'Invalid token' });

    const { email, name, sub: googleId } = payload;
    if (!email) return res.status(400).json({ error: 'Email not found in token' });

    let user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      const id = uuidv4();
      const createdAt = Date.now();
      const stmt = db.prepare('INSERT INTO users (id, email, googleId, name, createdAt) VALUES (?, ?, ?, ?, ?)');
      stmt.run(id, email, googleId, name, createdAt);
      user = { id, email, name };
    } else if (!user.googleId) {
      // Link Google account if email exists but no googleId
      const stmt = db.prepare('UPDATE users SET googleId = ? WHERE id = ?');
      stmt.run(googleId, user.id);
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Google login failed' });
  }
});

// Get Current User
router.get('/me', authenticateToken, (req: any, res) => {
  const user: any = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json(user);
});

export default router;
