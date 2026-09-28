// سرویس ووکامرس سمت سرور — کلیدها فقط از env خوانده می‌شوند و هرگز به کلاینت نمی‌روند (CR-4)
import { Router } from 'express';
import { requirePerm } from './auth.js';

export const woo = Router();

const CK = process.env.WOO_CONSUMER_KEY || '';
const CS = process.env.WOO_CONSUMER_SECRET || '';
const BASE = (process.env.WOO_STORE_URL || '').replace(/\/+$/, '');

woo.get('/status', requirePerm('read'), (_req, res) => {
  // فقط «آیا پیکربندی شده؟» — بدون افشای خودِ کلیدها
  res.json({ configured: !!(CK && CS && BASE), storeUrl: BASE ? BASE.replace(/^https?:\/\//, '') : '' });
});

async function wooFetch(path) {
  const url = `${BASE}/wp-json/wc/v3/${path}${path.includes('?') ? '&' : '?'}consumer_key=${CK}&consumer_secret=${CS}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw Object.assign(new Error(`woo http ${r.status}`), { status: r.status });
  return r.json();
}

woo.post('/test', requirePerm('write'), async (_req, res) => {
  if (!CK || !CS || !BASE) return res.status(400).json({ connected: false, error: 'server-not-configured' });
  try {
    await wooFetch('');
    res.json({ connected: true });
  } catch (e) {
    const msg = e.status === 401 || e.status === 403 ? 'invalid-keys' : e.message;
    res.status(200).json({ connected: false, error: msg }); // صادقانه؛ هیچ‌گاه true جعلی (HI-5)
  }
});

woo.get('/orders', requirePerm('read'), async (_req, res) => {
  if (!CK) return res.status(400).json({ error: 'server-not-configured' });
  res.json(await wooFetch('orders?per_page=50&status=processing,completed'));
});

woo.get('/products', requirePerm('read'), async (_req, res) => {
  if (!CK) return res.status(400).json({ error: 'server-not-configured' });
  res.json(await wooFetch('products?per_page=100'));
});
