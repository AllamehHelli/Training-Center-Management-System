// احراز هویت (JWT) + RBAC + لاگ ممیزی
import jwt from 'jsonwebtoken';
import { query, toJ } from './db.js';

const SECRET = process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET is required'); })();
export const TOKEN_TTL = '12h';

export function signToken(user) {
  return jwt.sign({ uid: user.id, role: user.role, name: user.display_name }, SECRET, { expiresIn: TOKEN_TTL });
}

export async function audit(req, action, entity, entityId, details) {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip) VALUES (?,?,?,?,?,?)`,
      [req.user?.uid ?? null, action, entity, entityId ?? '', toJ(details ?? null), req.ip ?? '']
    );
  } catch (e) { console.error('audit failed:', e.message); }
}

export function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

// نقش‌ها: admin > manager > staff > finance
const MATRIX = {
  read:   ['admin', 'manager', 'staff', 'finance'],
  write:  ['admin', 'manager', 'staff'],
  finance:['admin', 'manager', 'finance'],
  years:  ['admin', 'manager'],
  admin:  ['admin'],
};

export function requirePerm(kind) {
  return (req, res, next) => {
    const roles = MATRIX[kind] || [];
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}
