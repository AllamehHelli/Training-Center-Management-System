-- ============================================================
-- سامانه ثبت‌نام مدرسه — طرح پایگاه‌داده MySQL (cPanel)
-- اجرا: phpMyAdmin > تب SQL > Paste کل این فایل > Go
-- یا از CLI:  mysql -u USER -p DBNAME < schema.sql
-- ============================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ---------- کاربران و احراز هویت / RBAC ----------
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  username      VARCHAR(64)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  display_name  VARCHAR(128) NOT NULL DEFAULT '',
  role          ENUM('admin','manager','staff','finance') NOT NULL DEFAULT 'staff',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- سال‌های تحصیلی ----------
CREATE TABLE IF NOT EXISTS academic_years (
  id     VARCHAR(36)  NOT NULL PRIMARY KEY,
  label  VARCHAR(64)  NOT NULL,
  status ENUM('active','archived') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- state فعلیِ هر «اسلایس» سال: activeYearId، viewingYearId و شمارنده کد پیگیری
CREATE TABLE IF NOT EXISTS app_state (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v TEXT        NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- snapshot کامل سال بایگانی‌شده (JSON) — فقط‌خواندنی پس از بایگانی
CREATE TABLE IF NOT EXISTS archived_years (
  year_id   VARCHAR(36) NOT NULL PRIMARY KEY,
  data      JSON        NOT NULL,
  archived_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_arch_year FOREIGN KEY (year_id) REFERENCES academic_years(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- دانش‌آموزان ----------
CREATE TABLE IF NOT EXISTS students (
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,
  national_id  VARCHAR(10)  NOT NULL,
  first_name   VARCHAR(64)  NOT NULL,
  last_name    VARCHAR(64)  NOT NULL,
  father_name  VARCHAR(64)  NOT NULL DEFAULT '',
  birth_date   VARCHAR(10)  NOT NULL DEFAULT '',
  city         VARCHAR(64)  NOT NULL DEFAULT '',
  neighborhood VARCHAR(128) NOT NULL DEFAULT '',
  address      VARCHAR(255) NOT NULL DEFAULT '',
  phones       JSON         NULL,             -- [{label,value}, ...]
  emails       JSON         NULL,
  previous_school VARCHAR(128) NOT NULL DEFAULT '',
  gpa          DECIMAL(4,2) NULL,             -- معدل؛ ۰ مقدار مشروع است
  fields       JSON         NULL,             -- فیلدهای سفارشی تنظیمات
  notes        TEXT         NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_students_nid (national_id),    -- یکتایی سراسری کد ملی (CR-3/HI-2)
  KEY idx_students_name (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- کلاس‌ها / زنگ‌ها ----------
CREATE TABLE IF NOT EXISTS classes (
  id        VARCHAR(36)  NOT NULL PRIMARY KEY,
  name      VARCHAR(128) NOT NULL,
  grade     VARCHAR(32)  NOT NULL,
  teacher   VARCHAR(128) NOT NULL DEFAULT '',
  capacity  INT          NOT NULL DEFAULT 0,   -- مجموع ظرفیت زنگ‌ها
  day       VARCHAR(32)  NOT NULL DEFAULT '',
  time      VARCHAR(32)  NOT NULL DEFAULT '',
  sessions  JSON         NULL,                  -- [{id,title,day,time,startTime,endTime,capacity,enrolledCount}]
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_classes_grade (grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ثبت‌نام‌ها ----------
CREATE TABLE IF NOT EXISTS registrations (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  code            VARCHAR(20)   NOT NULL,       -- T-1405-0001 (یکتا، شمارنده سراسری)
  student_id      VARCHAR(36)   NOT NULL,
  class_id        VARCHAR(36)   NULL,
  session_id      VARCHAR(36)   NULL,
  status          ENUM('pending','approved','waitlist','cancelled') NOT NULL DEFAULT 'pending',
  plan_type       VARCHAR(32)   NOT NULL DEFAULT '',
  total_amount    BIGINT        NOT NULL DEFAULT 0,
  installments    JSON          NULL,           -- [{id,dueDate,amount,paid,paidDate}]
  discount_percent INT          NOT NULL DEFAULT 0,
  notes           TEXT          NULL,
  woo_order_id    VARCHAR(64)   NULL,           -- شناسه سفارش ووکامرس برای Idempotency (CR-3)
  year_id         VARCHAR(36)   NOT NULL,
  created_by      VARCHAR(36)   NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reg_code (code),                -- CR بحرانی: کد پیگیری تکراری نشود
  UNIQUE KEY uq_reg_woo_order (woo_order_id),   -- سفارش ووکامرس حداکثر یک بار ثبت می‌شود
  KEY idx_reg_year (year_id),
  KEY idx_reg_student (student_id),
  KEY idx_reg_class (class_id),
  CONSTRAINT fk_reg_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reg_class   FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE SET NULL,
  CONSTRAINT fk_reg_year    FOREIGN KEY (year_id)    REFERENCES academic_years(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- تنظیمات (تماس، اعلان، فیلدها، پیکربندی غیرمحرمانه ووکامرس) ----------
CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v JSON        NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- توجه: کلیدهای consumerKey/consumerSecret ووکامرس هرگز اینجا ذخیره نمی‌شوند (CR-4).
-- آن‌ها فقط در متغیرهای محیطی سمت سرور (.env) نگهداری می‌شوند.

-- ---------- لاگ ممیزی (Audit Log) ----------
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(36)  NULL,
  action     VARCHAR(64)  NOT NULL,   -- e.g. ADD_STUDENT, MARK_INSTALLMENT_PAID, LOGIN
  entity     VARCHAR(32)  NOT NULL,   -- student | registration | class | year | auth
  entity_id  VARCHAR(64)  NOT NULL DEFAULT '',
  details    JSON         NULL,       -- بدون هیچ فیلد محرمانه/شخصی حساس
  ip         VARCHAR(45)  NOT NULL DEFAULT '',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_entity (entity, entity_id),
  KEY idx_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- صف بررسی سفارش‌های ناسازگار ووکامرس (CR-3) ----------
CREATE TABLE IF NOT EXISTS woo_review_queue (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id     VARCHAR(64)  NOT NULL,
  payload      JSON         NOT NULL,
  reason       VARCHAR(255) NOT NULL,
  status       ENUM('pending','resolved','rejected') NOT NULL DEFAULT 'pending',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_queue_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- مقداردهی اولیه ----------
INSERT IGNORE INTO app_state (k, v) VALUES
  ('activeYearId',  '""'),
  ('viewingYearId', '""'),
  ('nextRegSeq',    '0');

-- کاربر پیش‌فرض: نام کاربری admin / رمز عبور CHANGE_ME_NOW
-- ⚠️ بلافاصله پس از اولین ورود، این رمز را عوض کنید.
-- هش درست با «npm run make-admin» ساخته و جایگزین شود:
-- INSERT INTO users (id, username, password_hash, display_name, role)
--   VALUES (UUID(), 'admin', '<bcrypt-hash>', 'مدیر سیستم', 'admin');
