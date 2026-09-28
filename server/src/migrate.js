// ابزارهای راه‌اندازی: اجرای schema.sql و ساخت کاربر admin
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME,
  multipleStatements: true,
});

const cmd = process.argv[2];

if (cmd === 'migrate') {
  const sql = fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8');
  await conn.query(sql);
  console.log('✅ schema applied');
} else if (cmd === 'make-admin') {
  const username = await ask('username (admin): ') || 'admin';
  const password = await ask('password: ');
  if (!password || password.length < 8) { console.error('رمز حداقل ۸ کاراکتر'); process.exit(1); }
  const hash = await bcrypt.hash(password, 12);
  await conn.execute(
    `INSERT INTO users (id,username,password_hash,display_name,role) VALUES (UUID(),?,?,'مدیر سیستم','admin')
     ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), role='admin'`,
    [username, hash]
  );
  console.log(`✅ user "${username}" ready`);
} else if (cmd === 'seed-demo') {
  // ورود اطلاعات یک export کامل از فرانت (فایل JSON خروجی «پشتیبان‌گیری») به DB
  const file = process.argv[3];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const y of data.academicYears || [])
    await conn.execute('INSERT IGNORE INTO academic_years (id,label,status) VALUES (?,?,?)', [y.id, y.label, y.status]);
  for (const s of data.students || [])
    await conn.execute(
      `INSERT IGNORE INTO students (id,national_id,first_name,last_name,father_name,birth_date,city,neighborhood,address,phones,emails,previous_school,gpa,fields,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [s.id, s.nationalId, s.firstName, s.lastName, s.fatherName || '', s.birthDate || '', s.city || '', s.neighborhood || '',
       s.address || '', JSON.stringify(s.phones || []), JSON.stringify(s.emails || []), s.previousSchool || '',
       s.gpa ?? null, JSON.stringify(s.fields || {}), s.notes || '']);
  for (const c of data.classes || [])
    await conn.execute('INSERT IGNORE INTO classes (id,name,grade,teacher,capacity,day,time,sessions) VALUES (?,?,?,?,?,?,?,?)',
      [c.id, c.name, c.grade, c.teacher || '', c.capacity || 0, c.day || '', c.time || '', JSON.stringify(c.sessions || [])]);
  for (const r of data.registrations || [])
    await conn.execute(
      `INSERT IGNORE INTO registrations (id,code,student_id,class_id,session_id,status,plan_type,total_amount,installments,discount_percent,notes,woo_order_id,year_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [r.id, r.code, r.studentId, r.classId || null, r.sessionId || null, r.status || 'pending', r.planType || '',
       r.totalAmount || 0, JSON.stringify(r.installments || []), r.discountPercent || 0, r.notes || '', r.wooOrderId || null, r.yearId]);
  if (data.activeYearId) await conn.execute('INSERT INTO app_state (k,v) VALUES ("activeYearId",?) ON DUPLICATE KEY UPDATE v=?', [JSON.stringify(data.activeYearId), JSON.stringify(data.activeYearId)]);
  if (typeof data.nextRegSeq === 'number') await conn.execute('INSERT INTO app_state (k,v) VALUES ("nextRegSeq",?) ON DUPLICATE KEY UPDATE v=?', [String(data.nextRegSeq), String(data.nextRegSeq)]);
  console.log('✅ demo/imported data seeded');
} else {
  console.log('usage: node src/migrate.js migrate | make-admin | seed-demo <export.json>');
}
await conn.end(); rl.close();
