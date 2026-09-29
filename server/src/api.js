// مسیرهای API: state، دانش‌آموز، کلاس، ثبت‌نام (تک‌نویس/اعمال تغییرات)
// قرارداد همگام‌سازی: فرانت‌اند «لاگ تغییرات» را با PUT /sync می‌فرستد؛ سریدر
// هر عملیات را روی دیتابیس اعمال و اعتبارسنجی نهایی (یکتایی کد ملی/کد پیگیری،
// ظرفیت زنگ، گارد سال بایگانی) را انجام می‌دهد. این «لایه دوم دفاع» است؛ لایه اول
// همان گاردهای store.tsx است که قبلاً برای CR-1/CR-3/LO-5 ساخته شده‌اند.
import { Router } from 'express';
import { query, toJ } from './db.js';
import { audit, requirePerm } from './auth.js';

export const api = Router();

const j = (v, fb) => { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fb); } catch { return fb; } };

async function getStateValue(k, fb) {
  const rows = await query('SELECT v FROM app_state WHERE k=?', [k]);
  if (!rows.length) return fb;
  try { return JSON.parse(rows[0].v); } catch { return rows[0].v; }
}
async function setStateValue(k, v) {
  await query(
    'INSERT INTO app_state (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=?',
    [k, toJ(v), toJ(v)]
  );
}

// ---------- GET /api/state — کل وضعیت سمت سرور ----------
api.get('/state', requirePerm('read'), async (req, res) => {
  const [years, students, classes, registrations, settingsRows, archivedRows, teachers, counselors] = await Promise.all([
    query('SELECT id,label,status FROM academic_years'),
    query('SELECT * FROM students ORDER BY created_at DESC'),
    query('SELECT * FROM classes ORDER BY created_at ASC'),
    query('SELECT * FROM registrations ORDER BY created_at DESC'),
    query('SELECT k,v FROM settings'),
    query('SELECT year_id,data,archived_at FROM archived_years'),
    query('SELECT * FROM teachers ORDER BY created_at DESC').catch(() => []),
    query('SELECT * FROM counselors ORDER BY created_at DESC').catch(() => []),
  ]);
  const settings = {};
  for (const s of settingsRows) settings[s.k] = j(s.v, {});
  // ⚠️ هیچ credential ووکامرسی هرگز از سرور به کلاینت ارسال نمی‌شود (CR-4)
  delete settings.woo?.consumerKey; delete settings.woo?.consumerSecret;
  res.json({
    academicYears: years,
    activeYearId: await getStateValue('activeYearId', ''),
    viewingYearId: await getStateValue('viewingYearId', ''),
    nextRegSeq: Number(await getStateValue('nextRegSeq', 0)),
    students: students.map(mapStudent),
    classes: classes.map(mapClass),
    registrations: registrations.map(mapReg),
    teachers: (teachers || []).map(mapTeacher),
    counselors: (counselors || []).map(mapCounselor),
    settings,
    archivedData: Object.fromEntries(archivedRows.map((a) => [a.year_id, j(a.data, null)])),
  });
});

const mapStudent = (r) => ({
  id: r.id, nationalId: r.national_id, firstName: r.first_name, lastName: r.last_name,
  fatherName: r.father_name, birthDate: r.birth_date, city: r.city, neighborhood: r.neighborhood,
  address: r.address, phones: j(r.phones, []), emails: j(r.emails, []),
  previousSchool: r.previous_school, gpa: r.gpa == null ? undefined : Number(r.gpa),
  grade: r.grade || 'هفتم', school: r.school || '',
  counselorId: r.counselor_id || undefined, counselorName: r.counselor_name || undefined,
  fields: j(r.fields, {}), notes: r.notes || '', createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapClass = (r) => ({
  id: r.id, name: r.name, grade: r.grade, teacher: r.teacher, capacity: r.capacity,
  tuition: Number(r.tuition) || 0, teacherId: r.teacher_id || undefined,
  day: r.day, time: r.time, sessions: j(r.sessions, []), createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapTeacher = (r) => ({
  id: r.id, firstName: r.first_name, lastName: r.last_name, nationalId: r.national_id || '',
  phone: r.phone || '', email: r.email || '', specialty: r.specialty || '', degree: r.degree || '',
  notes: r.notes || '', isActive: r.is_active === 1 || r.is_active === true,
  createdAt: r.created_at || '', updatedAt: r.updated_at || '',
});
const mapCounselor = (r) => ({
  id: r.id, firstName: r.first_name, lastName: r.last_name, nationalId: r.national_id || '',
  phone: r.phone || '', email: r.email || '', specialty: r.specialty || '', grades: j(r.grades, []),
  maxCapacity: Number(r.max_capacity) || 30, notes: r.notes || '',
  isActive: r.is_active === 1 || r.is_active === true,
  createdAt: r.created_at || '', updatedAt: r.updated_at || '',
});
const mapReg = (r) => ({
  id: r.id, code: r.code, studentId: r.student_id, classId: r.class_id, sessionId: r.session_id,
  status: r.status, planType: r.plan_type, totalAmount: Number(r.total_amount),
  installments: j(r.installments, []), discountPercent: r.discount_percent, notes: r.notes || '',
  wooOrderId: r.woo_order_id, yearId: r.year_id, createdAt: r.created_at, updatedAt: r.updated_at,
});

// ---------- POST /api/students | PUT | DELETE ----------
api.post('/students', requirePerm('write'), async (req, res) => {
  const s = req.body;
  try {
    await query(
      `INSERT INTO students (id,national_id,first_name,last_name,father_name,birth_date,grade,school,city,neighborhood,address,phones,emails,previous_school,gpa,fields,notes,counselor_id,counselor_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [s.id, s.nationalId, s.firstName, s.lastName, s.fatherName || '', s.birthDate || '', s.grade || 'هفتم', s.school || '',
       s.city || '', s.neighborhood || '', s.address || '', toJ(s.phones || []), toJ(s.emails || []), s.previousSchool || '',
       s.gpa ?? null, toJ(s.fields || {}), s.notes || '', s.counselorId || null, s.counselorName || null]
    );
    await audit(req, 'ADD_STUDENT', 'student', s.id, { nationalId: mask(s.nationalId) });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'duplicate-national-id' });
    throw e;
  }
});

api.put('/students/:id', requirePerm('write'), async (req, res) => {
  const s = { ...req.body, id: req.params.id };
  try {
    await query(
      `UPDATE students SET national_id=?,first_name=?,last_name=?,father_name=?,birth_date=?,grade=?,school=?,city=?,neighborhood=?,address=?,phones=?,emails=?,previous_school=?,gpa=?,fields=?,notes=?,counselor_id=?,counselor_name=? WHERE id=?`,
      [s.nationalId, s.firstName, s.lastName, s.fatherName || '', s.birthDate || '', s.grade || 'هفتم', s.school || '',
       s.city || '', s.neighborhood || '', s.address || '', toJ(s.phones || []), toJ(s.emails || []), s.previousSchool || '',
       s.gpa ?? null, toJ(s.fields || {}), s.notes || '', s.counselorId || null, s.counselorName || null, s.id]
    );
    await audit(req, 'UPDATE_STUDENT', 'student', s.id, {});
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'duplicate-national-id' });
    throw e;
  }
});

api.delete('/students/:id', requirePerm('write'), async (req, res) => {
  await query('DELETE FROM students WHERE id=?', [req.params.id]); // FK RESTRICT اگر ثبت‌نام دارد خطا می‌دهد
  await audit(req, 'DELETE_STUDENT', 'student', req.params.id, {});
  res.json({ ok: true });
});

// ---------- کلاس‌ها (گارد ظرفیت در سطح DB: LO-5) ----------
async function saveClass(s, isNew) {
  // clamp ظرفیت به تعداد ثبت‌نام فعال هر زنگ — لایه دوم دفاع
  const regs = await query(
    "SELECT class_id, session_id, COUNT(*) c FROM registrations WHERE class_id=? AND status<>'cancelled' GROUP BY class_id, session_id",
    [s.id]
  );
  const bySession = Object.fromEntries(regs.map((r) => [r.session_id, Number(r.c)]));
  const sessions = (s.sessions || []).map((ses) => ({
    ...ses,
    capacity: Math.max(Number(ses.capacity) || 0, bySession[ses.id] || 0),
    enrolledCount: bySession[ses.id] || ses.enrolledCount || 0,
  }));
  const capacity = sessions.reduce((a, x) => a + (Number(x.capacity) || 0), 0);
  const sql = isNew
    ? `INSERT INTO classes (id,name,grade,teacher,capacity,tuition,day,time,sessions,teacher_id) VALUES (?,?,?,?,?,?,?,?,?,?)`
    : `UPDATE classes SET name=?,grade=?,teacher=?,capacity=?,tuition=?,day=?,time=?,sessions=?,teacher_id=? WHERE id=?`;
  const params = isNew
    ? [s.id, s.name, s.grade, s.teacher || '', capacity, Number(s.tuition) || 0, s.day || '', s.time || '', toJ(sessions), s.teacherId || null]
    : [s.name, s.grade, s.teacher || '', capacity, Number(s.tuition) || 0, s.day || '', s.time || '', toJ(sessions), s.teacherId || null, s.id];
  await query(sql, params);
  return sessions;
}
api.post('/classes', requirePerm('write'), async (req, res) => {
  const sessions = await saveClass(req.body, true);
  await audit(req, 'ADD_CLASS', 'class', req.body.id, {});
  res.json({ ok: true, sessions });
});
api.put('/classes/:id', requirePerm('write'), async (req, res) => {
  const sessions = await saveClass({ ...req.body, id: req.params.id }, false);
  await audit(req, 'UPDATE_CLASS', 'class', req.params.id, {});
  res.json({ ok: true, sessions });
});
api.delete('/classes/:id', requirePerm('write'), async (req, res) => {
  await query('DELETE FROM classes WHERE id=?', [req.params.id]);
  await audit(req, 'DELETE_CLASS', 'class', req.params.id, {});
  res.json({ ok: true });
});

// ---------- بانک اساتید ----------
api.get('/teachers', requirePerm('read'), async (req, res) => {
  const rows = await query('SELECT * FROM teachers ORDER BY created_at DESC').catch(() => []);
  res.json(rows.map(mapTeacher));
});
api.post('/teachers', requirePerm('write'), async (req, res) => {
  const t = req.body;
  const id = t.id || `tch-${Date.now()}`;
  await query(
    `INSERT INTO teachers (id,first_name,last_name,national_id,phone,email,specialty,degree,notes,is_active,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, t.firstName || '', t.lastName || '', t.nationalId || '', t.phone || '', t.email || '',
     t.specialty || '', t.degree || '', t.notes || '', t.isActive === false ? 0 : 1, t.createdAt || '', t.updatedAt || '']
  );
  await audit(req, 'ADD_TEACHER', 'teacher', id, {});
  res.json({ ok: true, id });
});
api.put('/teachers/:id', requirePerm('write'), async (req, res) => {
  const t = req.body;
  await query(
    `UPDATE teachers SET first_name=?,last_name=?,national_id=?,phone=?,email=?,specialty=?,degree=?,notes=?,is_active=?,updated_at=? WHERE id=?`,
    [t.firstName || '', t.lastName || '', t.nationalId || '', t.phone || '', t.email || '',
     t.specialty || '', t.degree || '', t.notes || '', t.isActive === false ? 0 : 1, t.updatedAt || '', req.params.id]
  );
  await audit(req, 'UPDATE_TEACHER', 'teacher', req.params.id, {});
  res.json({ ok: true });
});
api.delete('/teachers/:id', requirePerm('write'), async (req, res) => {
  await query('DELETE FROM teachers WHERE id=?', [req.params.id]);
  await query('UPDATE classes SET teacher_id=NULL WHERE teacher_id=?', [req.params.id]).catch(() => {});
  await audit(req, 'DELETE_TEACHER', 'teacher', req.params.id, {});
  res.json({ ok: true });
});

// ---------- بانک مشاوران ----------
api.get('/counselors', requirePerm('read'), async (req, res) => {
  const rows = await query('SELECT * FROM counselors ORDER BY created_at DESC').catch(() => []);
  res.json(rows.map(mapCounselor));
});
api.post('/counselors', requirePerm('write'), async (req, res) => {
  const cn = req.body;
  const id = cn.id || `cns-${Date.now()}`;
  await query(
    `INSERT INTO counselors (id,first_name,last_name,national_id,phone,email,specialty,grades,max_capacity,notes,is_active,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, cn.firstName || '', cn.lastName || '', cn.nationalId || '', cn.phone || '', cn.email || '',
     cn.specialty || '', toJ(cn.grades || []), Number(cn.maxCapacity) || 30, cn.notes || '',
     cn.isActive === false ? 0 : 1, cn.createdAt || '', cn.updatedAt || '']
  );
  await audit(req, 'ADD_COUNSELOR', 'counselor', id, {});
  res.json({ ok: true, id });
});
api.put('/counselors/:id', requirePerm('write'), async (req, res) => {
  const cn = req.body;
  await query(
    `UPDATE counselors SET first_name=?,last_name=?,national_id=?,phone=?,email=?,specialty=?,grades=?,max_capacity=?,notes=?,is_active=?,updated_at=? WHERE id=?`,
    [cn.firstName || '', cn.lastName || '', cn.nationalId || '', cn.phone || '', cn.email || '',
     cn.specialty || '', toJ(cn.grades || []), Number(cn.maxCapacity) || 30, cn.notes || '',
     cn.isActive === false ? 0 : 1, cn.updatedAt || '', req.params.id]
  );
  await audit(req, 'UPDATE_COUNSELOR', 'counselor', req.params.id, {});
  res.json({ ok: true });
});
api.delete('/counselors/:id', requirePerm('write'), async (req, res) => {
  await query('DELETE FROM counselors WHERE id=?', [req.params.id]);
  await query('UPDATE students SET counselor_id=NULL, counselor_name=NULL WHERE counselor_id=?', [req.params.id]).catch(() => {});
  await audit(req, 'DELETE_COUNSELOR', 'counselor', req.params.id, {});
  res.json({ ok: true });
});

// ---------- ثبت‌نام ----------
api.post('/registrations', requirePerm('write'), async (req, res) => {
  const r = req.body;
  // گارد CR-1: نوشتن داخل سال بایگانی‌شده ممنوع
  const y = await query('SELECT status FROM academic_years WHERE id=?', [r.yearId]);
  if (!y.length || y[0].status === 'archived') return res.status(423).json({ error: 'archived-year-read-only' });
  // صدور اتمیک کد پیگیری با شمارنده سراسری (بدون وابستگی به حذف/سال)
  const seq = Number(await getStateValue('nextRegSeq', 0)) + 1;
  const code = r.code || makeCode(seq, r.jalaliYear || new Date().getFullYear());
  try {
    await query(
      `INSERT INTO registrations (id,code,student_id,class_id,session_id,status,plan_type,total_amount,installments,discount_percent,notes,woo_order_id,year_id,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [r.id, code, r.studentId, r.classId || null, r.sessionId || null, r.status || 'pending',
       r.planType || '', r.totalAmount || 0, toJ(r.installments || []), r.discountPercent || 0,
       r.notes || '', r.wooOrderId || null, r.yearId, req.user.uid]
    );
    await setStateValue('nextRegSeq', seq);
    await bumpEnrolledCounts(r.classId);
    await audit(req, 'ADD_REGISTRATION', 'registration', r.id, { code });
    res.json({ ok: true, code, nextRegSeq: seq });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'duplicate (order already synced or code collision)' });
    throw e;
  }
});

api.put('/registrations/:id', requirePerm('write'), async (req, res) => {
  const r = { ...req.body, id: req.params.id };
  const y = await query('SELECT status FROM academic_years WHERE id=?', [r.yearId]);
  if (y.length && y[0].status === 'archived') return res.status(423).json({ error: 'archived-year-read-only' });
  await query(
    `UPDATE registrations SET student_id=?,class_id=?,session_id=?,status=?,plan_type=?,total_amount=?,installments=?,discount_percent=?,notes=? WHERE id=?`,
    [r.studentId, r.classId || null, r.sessionId || null, r.status, r.planType || '', r.totalAmount || 0,
     toJ(r.installments || []), r.discountPercent || 0, r.notes || '', r.id]
  );
  await bumpEnrolledCounts(r.classId);
  await audit(req, 'UPDATE_REGISTRATION', 'registration', r.id, {});
  res.json({ ok: true });
});

api.delete('/registrations/:id', requirePerm('write'), async (req, res) => {
  const [row] = await query('SELECT class_id, year_id FROM registrations WHERE id=?', [req.params.id]);
  await query('DELETE FROM registrations WHERE id=?', [req.params.id]);
  if (row?.class_id) await bumpEnrolledCounts(row.class_id);
  await audit(req, 'DELETE_REGISTRATION', 'registration', req.params.id, {});
  res.json({ ok: true });
});

// پرداخت قسط — فقط نقش‌های مالی (RBAC)
api.post('/registrations/:id/installments/:instId/pay', requirePerm('finance'), async (req, res) => {
  const [row] = await query('SELECT * FROM registrations WHERE id=?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'not-found' });
  const y = await query('SELECT status FROM academic_years WHERE id=?', [row.year_id]);
  if (y.length && y[0].status === 'archived') return res.status(423).json({ error: 'archived-year-read-only' });
  const insts = j(row.installments, []);
  const it = insts.find((x) => x.id === req.params.instId);
  if (!it) return res.status(404).json({ error: 'installment-not-found' });
  it.paid = true; it.paidDate = req.body.paidDate || '';
  await query('UPDATE registrations SET installments=? WHERE id=?', [toJ(insts), row.id]);
  await audit(req, 'MARK_INSTALLMENT_PAID', 'registration', row.id, { installment: it.id, paidDate: it.paidDate });
  res.json({ ok: true, installments: insts });
});

api.post('/registrations/:id/installments/:instId/refund', requirePerm('finance'), async (req, res) => {
  const [row] = await query('SELECT * FROM registrations WHERE id=?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'not-found' });
  const insts = j(row.installments, []);
  const it = insts.find((x) => x.id === req.params.instId);
  if (it) { it.paid = false; delete it.paidDate; }
  await query('UPDATE registrations SET installments=? WHERE id=?', [toJ(insts), row.id]);
  await audit(req, 'REFUND_INSTALLMENT', 'registration', row.id, { installment: it?.id });
  res.json({ ok: true, installments: insts });
});

// ---------- تنظیمات ----------
api.put('/settings/:key', requirePerm('write'), async (req, res) => {
  const allowed = ['contact', 'notify', 'fieldSettings', 'grades', 'wooPublic'];
  if (!allowed.includes(req.params.key)) return res.status(400).json({ error: 'unknown-settings-key' });
  if (req.params.key === 'wooPublic') { // فیلتر عمدی: هرگز secret عبور نکند (CR-4)
    const { consumerKey, consumerSecret, ...pub } = req.body || {};
    return res.json({ ok: true, ignoredSecrets: !!(consumerKey || consumerSecret) });
  }
  await query('INSERT INTO settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=?',
    [req.params.key, toJ(req.body), toJ(req.body)]);
  await audit(req, 'UPDATE_SETTINGS', 'settings', req.params.key, {});
  res.json({ ok: true });
});

// ---------- سال تحصیلی / آرشیو (CR-1) ----------
api.post('/years', requirePerm('years'), async (req, res) => {
  await query('INSERT INTO academic_years (id,label,status) VALUES (?,?, "active")', [req.body.id, req.body.label]);
  await setStateValue('activeYearId', req.body.id);
  await setStateValue('viewingYearId', req.body.id);
  await audit(req, 'START_NEW_YEAR', 'year', req.body.id, { label: req.body.label });
  res.json({ ok: true });
});
api.post('/years/:id/archive', requirePerm('years'), async (req, res) => {
  const snapshot = await buildSnapshot(req.params.id);
  await query('INSERT INTO archived_years (year_id,data) VALUES (?,?) ON DUPLICATE KEY UPDATE data=?',
    [req.params.id, toJ(snapshot), toJ(snapshot)]);
  await query("UPDATE academic_years SET status='archived' WHERE id=?", [req.params.id]);
  await audit(req, 'ARCHIVE_YEAR', 'year', req.params.id, {});
  res.json({ ok: true });
});
api.put('/viewing-year', requirePerm('read'), async (req, res) => {
  await setStateValue('viewingYearId', String(req.body.yearId || ''));
  res.json({ ok: true });
});

async function buildSnapshot(yearId) {
  const [students, classes, registrations] = await Promise.all([
    query('SELECT * FROM students'), query('SELECT * FROM classes'),
    query('SELECT * FROM registrations WHERE year_id=?', [yearId]),
  ]);
  return { students: students.map(mapStudent), classes: classes.map(mapClass), registrations: registrations.map(mapReg) };
}

async function bumpEnrolledCounts(classId) {
  if (!classId) return;
  const [cls] = await query('SELECT sessions FROM classes WHERE id=?', [classId]);
  if (!cls) return;
  const counts = await query(
    "SELECT session_id, COUNT(*) c FROM registrations WHERE class_id=? AND status<>'cancelled' GROUP BY session_id",
    [classId]
  );
  const map = Object.fromEntries(counts.map((r) => [r.session_id, Number(r.c)]));
  const sessions = j(cls.sessions, []).map((s) => ({ ...s, enrolledCount: map[s.id] || 0 }));
  await query('UPDATE classes SET sessions=? WHERE id=?', [toJ(sessions), classId]);
}

function makeCode(seq, jy) { return `T-${jy}-${String(seq).padStart(4, '0')}`; }
function mask(nid) { return nid ? nid.slice(0, 3) + '****' + nid.slice(-2) : ''; }
