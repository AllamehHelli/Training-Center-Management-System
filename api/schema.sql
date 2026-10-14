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
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,
  title        VARCHAR(128) NOT NULL DEFAULT '',
  short_title  VARCHAR(32)  NOT NULL DEFAULT '',
  period_label VARCHAR(128) NOT NULL DEFAULT '',
  start_date   VARCHAR(10)  NOT NULL DEFAULT '',
  end_date     VARCHAR(10)  NOT NULL DEFAULT '',
  status       ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- state فعلیِ هر «اسلایس» سال: activeYearId، viewingYearId و شمارنده کد پیگیری
CREATE TABLE IF NOT EXISTS app_state (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v TEXT        NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- snapshot کامل سال بایگانی‌شده (JSON) — فقط‌خواندنی پس از بایگانی
CREATE TABLE IF NOT EXISTS archived_years (
  year_id     VARCHAR(36) NOT NULL PRIMARY KEY,
  data        LONGTEXT    NOT NULL,
  archived_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_arch_year FOREIGN KEY (year_id) REFERENCES academic_years(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- دانش‌آموزان ----------
CREATE TABLE IF NOT EXISTS students (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  national_id     VARCHAR(10)  NOT NULL,
  first_name      VARCHAR(64)  NOT NULL,
  last_name       VARCHAR(64)  NOT NULL,
  father_name     VARCHAR(64)  NOT NULL DEFAULT '',
  birth_date      VARCHAR(10)  NOT NULL DEFAULT '',
  grade           VARCHAR(32)  NOT NULL DEFAULT 'هفتم',
  gpa             DECIMAL(4,2) NULL,
  school          VARCHAR(128) NOT NULL DEFAULT '',
  city            VARCHAR(64)  NOT NULL DEFAULT '',
  neighborhood    VARCHAR(128) NOT NULL DEFAULT '',
  address         VARCHAR(255) NOT NULL DEFAULT '',
  phones          JSON         NULL,             -- [{label,value}, ...]
  emails          JSON         NULL,
  previous_school VARCHAR(128) NOT NULL DEFAULT '',
  fields          JSON         NULL,             -- فیلدهای سفارشی تنظیمات
  notes           TEXT         NULL,
  counselor_id    VARCHAR(64)  NULL,             -- ارجاع به مشاور تحصیلی تخصیص‌یافته
  counselor_name  VARCHAR(128) NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_students_nid (national_id),
  KEY idx_students_name (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- کلاس‌ها / زنگ‌ها ----------
CREATE TABLE IF NOT EXISTS classes (
  id                 VARCHAR(36)  NOT NULL PRIMARY KEY,
  name               VARCHAR(128) NOT NULL,
  grade              VARCHAR(32)  NOT NULL,
  teacher            VARCHAR(128) NOT NULL DEFAULT '',
  capacity           INT          NOT NULL DEFAULT 0,
  tuition            BIGINT       NOT NULL DEFAULT 0,
  teacher_id         VARCHAR(64)  NULL,
  day                VARCHAR(32)  NOT NULL DEFAULT '',
  time               VARCHAR(32)  NOT NULL DEFAULT '',
  sessions           JSON         NULL,
  is_package         TINYINT(1)   NOT NULL DEFAULT 0,
  package_course_ids JSON         NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_classes_grade (grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ثبت‌نام‌ها ----------
CREATE TABLE IF NOT EXISTS registrations (
  id                 VARCHAR(36)   NOT NULL PRIMARY KEY,
  code               VARCHAR(32)   NOT NULL,
  student_id         VARCHAR(36)   NOT NULL,
  class_id           VARCHAR(36)   NULL,
  session_id         VARCHAR(36)   NULL,
  status             ENUM('pending','approved','waitlist','cancelled') NOT NULL DEFAULT 'pending',
  amount             BIGINT        NOT NULL DEFAULT 0,
  discount           INT           NOT NULL DEFAULT 0,
  plan               JSON          NULL,
  reg_date           VARCHAR(10)   NOT NULL DEFAULT '',
  notes              TEXT          NULL,
  woo_order_id       VARCHAR(64)   NULL,
  is_package         TINYINT(1)    NOT NULL DEFAULT 0,
  package_selections JSON          NULL,
  year_id            VARCHAR(36)   NOT NULL,
  created_by         VARCHAR(36)   NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reg_code (code),
  UNIQUE KEY uq_reg_woo_order (woo_order_id),
  KEY idx_reg_year (year_id),
  KEY idx_reg_student (student_id),
  KEY idx_reg_class (class_id),
  CONSTRAINT fk_reg_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reg_class   FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE SET NULL,
  CONSTRAINT fk_reg_year    FOREIGN KEY (year_id)    REFERENCES academic_years(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- تنظیمات ----------
CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v JSON        NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- لاگ ممیزی (Audit Log) ----------
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(36)  NULL,
  action     VARCHAR(64)  NOT NULL,
  entity     VARCHAR(32)  NOT NULL,
  entity_id  VARCHAR(64)  NOT NULL DEFAULT '',
  details    JSON         NULL,
  ip         VARCHAR(45)  NOT NULL DEFAULT '',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_entity (entity, entity_id),
  KEY idx_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- بانک اساتید ----------
CREATE TABLE IF NOT EXISTS teachers (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  first_name  VARCHAR(64)  NOT NULL,
  last_name   VARCHAR(64)  NOT NULL,
  national_id VARCHAR(10)  NOT NULL DEFAULT '',
  phone       VARCHAR(32)  NOT NULL DEFAULT '',
  email       VARCHAR(128) NOT NULL DEFAULT '',
  specialty   VARCHAR(128) NOT NULL DEFAULT '',
  degree      VARCHAR(128) NOT NULL DEFAULT '',
  notes       TEXT         NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  VARCHAR(32)  NULL,
  updated_at  VARCHAR(32)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- بانک مشاوران تحصیلی ----------
CREATE TABLE IF NOT EXISTS counselors (
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  first_name   VARCHAR(64)  NOT NULL,
  last_name    VARCHAR(64)  NOT NULL,
  national_id  VARCHAR(10)  NOT NULL DEFAULT '',
  phone        VARCHAR(32)  NOT NULL DEFAULT '',
  email        VARCHAR(128) NOT NULL DEFAULT '',
  specialty    VARCHAR(128) NOT NULL DEFAULT '',
  grades       JSON         NULL,
  max_capacity INT          NOT NULL DEFAULT 30,
  notes        TEXT         NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   VARCHAR(32)  NULL,
  updated_at   VARCHAR(32)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- صف بررسی سفارش‌های ناسازگار ووکامرس ----------
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
  ('nextRegSeq',    '100');
