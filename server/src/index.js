// ورودی سرور: Express + Auth + API + Woo + سرو فایل‌های build فرانت‌اند
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { query, toJ } from './db.js';
import { signToken, authRequired, audit, requirePerm } from './auth.js';
import { api } from './api.js';
import { woo } from './woo.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));
if (process.env.CORS_ORIGIN) app.use(cors({ origin: process.env.CORS_ORIGIN.split(',') }));

// ---------- Auth ----------
const auth = Router();
auth.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const rows = await query('SELECT * FROM users WHERE username=? AND is_active=1', [String(username || '')]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
    return res.status(401).json({ error: 'invalid-credentials' }); // پیام مبهم برای جلوگیری از username enumeration
  }
  await audit({ user: { uid: user.id }, ip: req.ip }, 'LOGIN', 'auth', user.id, {});
  res.json({ token: signToken(user), user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } });
});
auth.get('/me', authRequired, (req, res) => res.json({ user: req.user }));
auth.post('/change-password', authRequired, requirePerm('admin'), async (req, res) => {
  const { userId, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) return res.status(400).json({ error: 'password-too-short' });
  const hash = await bcrypt.hash(String(newPassword), 12);
  await query('UPDATE users SET password_hash=? WHERE id=?', [hash, userId]);
  await audit(req, 'CHANGE_PASSWORD', 'auth', userId, {});
  res.json({ ok: true });
});

app.use('/api/auth', auth);
app.use('/api', authRequired, api);
app.use('/api/woo', authRequired, woo);

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ---------- فرانت‌اند build شده (SPA) ----------
const dist = path.resolve(__dirname, '../../dist');
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (_req, res, next) => {
  res.sendFile(path.join(dist, 'index.html'), (err) => err && next());
});

// خطای سراسری — جزئیات فنی به کلاینت نمی‌رود
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal-error' });
});

const PORT = Number(process.env.PORT || 3777);
app.listen(PORT, '0.0.0.0', () => console.log(`server up on 0.0.0.0:${PORT}`));
