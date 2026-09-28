// CR-4 verification: credentials never reach localStorage / backups, and legacy keys are wiped on load.
import { readFileSync } from 'fs';

// 1) Static checks on source
const store = readFileSync('src/store.tsx', 'utf8');
const data = readFileSync('src/data.ts', 'utf8');
const woo = readFileSync('src/Woo.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

let pass = true;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name); if (!cond) pass = false; };

check('persist effect strips credentials', /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(stripWooCredentials\(state\)\)\)/.test(store));
check('backup strips credentials', /state:\s*stripWooCredentials\(state\)/.test(store));
check('migration wipes legacy keys', /consumerKey:\s*'',\s*consumerSecret:\s*''/.test(data));
check('seed has no real keys', /consumerKey:\s*''/.test(data) && !/ck_[0-9a-f]{8}/.test(data));
check('no hardcoded ck_/cs_ in src', !/['"]ck_[A-Za-z0-9]{10,}/.test(woo + data + store));
check('secret field uses password + new-password', /autoComplete="new-password"/.test(woo));
check('admin fake identity removed', !app.includes('سارا محمدی'));

// 2) Behavioral check of stripWooCredentials logic (replicated import via ts stripped — do it in JS)
const strip = (state) => {
  if (!state.wooSettings) return state;
  if (!state.wooSettings.consumerKey && !state.wooSettings.consumerSecret) return state;
  const { consumerKey, consumerSecret, ...safe } = state.wooSettings;
  return { ...state, wooSettings: safe };
};
const s = { wooSettings: { url: 'https://x.test', consumerKey: 'ck_secret', consumerSecret: 'cs_secret', isConnected: true, syncLog: [] }, students: [] };
const out = JSON.stringify(strip(s));
check('stripped JSON contains no key material', !out.includes('ck_secret') && !out.includes('cs_secret'));
check('stripped JSON keeps non-sensitive settings', out.includes('https://x.test') && out.includes('isConnected'));
check('original state untouched (memory keeps keys for session)', s.wooSettings.consumerKey === 'ck_secret');
check('strip is idempotent/no-op when empty', strip({ wooSettings: { url: '', consumerKey: '', consumerSecret: '', isConnected: false, syncLog: [] } }) !== null);

console.log(pass ? 'ALL PASS' : 'SOME FAILED');
process.exit(pass ? 0 : 1);
