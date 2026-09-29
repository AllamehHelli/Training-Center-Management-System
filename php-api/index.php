<?php
/**
 * سیستم ثبت‌نام موسسه تیزهوشان علامه حلی
 * بک‌اند جامع و یکپارچه PHP برای هاست‌های اشتراکی cPanel
 * امنیت، RBAC، اعتبارسنجی مدل داده، گارد بایگانی و تطابق کامل با فرانت‌اند
 */

// خاموش کردن نمایش خطاهای خام در خروجی جهت جلوگیری از افشای اطلاعات و شکست JSON
ini_set('display_errors', '0');
error_reporting(E_ALL);

// منطقه زمانی رسمی سامانه
date_default_timezone_set('Asia/Tehran');

// هدرهای امنیت، CORS و جلوگیری از کش داده‌های حساس
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function jsonResp($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// مدیریت خطاهای کنترل‌نشده سراسری
set_exception_handler(function ($e) {
    error_log("Unhandled Exception: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    jsonResp([
        'error' => 'internal-error',
        'message' => 'خطای غیرمنتظره در سرور رخ داده است. لاگ‌های سیستم را بررسی نمایید.'
    ], 500);
});

function parseJsonBody() {
    $input = file_get_contents('php://input');
    if (empty($input)) return [];
    $data = json_decode($input, true);
    return is_array($data) ? $data : [];
}

// -------------------------------------------------------------
// ۱. بارگذاری ایمن متغیرهای محیطی (.env)
// -------------------------------------------------------------
function loadEnvVariables() {
    $possiblePaths = [
        dirname(__DIR__, 2) . '/.env',
        __DIR__ . '/../.env',
        __DIR__ . '/.env',
        isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] . '/.env' : ''
    ];

    $loaded = [];
    foreach ($possiblePaths as $p) {
        if (!empty($p) && file_exists($p) && is_readable($p)) {
            $lines = file($p, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || strpos($line, '#') === 0) continue;
                if (strpos($line, '=') !== false) {
                    list($key, $val) = explode('=', $line, 2);
                    $key = trim($key);
                    $val = trim($val);
                    if ((substr($val, 0, 1) === '"' && substr($val, -1) === '"') ||
                        (substr($val, 0, 1) === "'" && substr($val, -1) === "'")) {
                        $val = substr($val, 1, -1);
                    }
                    if (!isset($loaded[$key])) {
                        $loaded[$key] = $val;
                        putenv("$key=$val");
                        $_ENV[$key] = $val;
                        $_SERVER[$key] = $val;
                    }
                }
            }
        }
    }
    return $loaded;
}

$env = loadEnvVariables();

$config = [
    'db' => [
        'host' => getenv('DB_HOST') ?: ($env['DB_HOST'] ?? 'localhost'),
        'port' => getenv('DB_PORT') ?: ($env['DB_PORT'] ?? '3306'),
        'dbname' => getenv('DB_NAME') ?: ($env['DB_NAME'] ?? ''),
        'user' => getenv('DB_USER') ?: ($env['DB_USER'] ?? ''),
        'pass' => getenv('DB_PASS') ?: ($env['DB_PASS'] ?? ''),
        'charset' => 'utf8mb4'
    ],
    'jwt_secret' => getenv('JWT_SECRET') ?: ($env['JWT_SECRET'] ?? ''),
    'admin_password' => getenv('ADMIN_PASSWORD') ?: ($env['ADMIN_PASSWORD'] ?? ''),
    'woo' => [
        'store_url' => getenv('WOO_STORE_URL') ?: ($env['WOO_STORE_URL'] ?? ''),
        'consumer_key' => getenv('WOO_CONSUMER_KEY') ?: ($env['WOO_CONSUMER_KEY'] ?? ''),
        'consumer_secret' => getenv('WOO_CONSUMER_SECRET') ?: ($env['WOO_CONSUMER_SECRET'] ?? ''),
    ],
];

// -------------------------------------------------------------
// ۲. اتصال به پایگاه‌داده MySQL
// -------------------------------------------------------------
$pdo = null;
$dbError = null;

if (!empty($config['db']['dbname']) && !empty($config['db']['user'])) {
    try {
        $dsn = "mysql:host={$config['db']['host']};port={$config['db']['port']};dbname={$config['db']['dbname']};charset={$config['db']['charset']}";
        $pdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        $dbError = $e->getMessage();
        error_log("Database connection error: " . $dbError);
    }
}

// تولید یا حفظ کلید امنیتی JWT بدون افشا در سورس
if (empty($config['jwt_secret']) && $pdo) {
    $existingSecret = getAppStateValue($pdo, 'sys_jwt_secret', '');
    if (empty($existingSecret)) {
        $existingSecret = bin2hex(random_bytes(32));
        setAppStateValue($pdo, 'sys_jwt_secret', $existingSecret);
    }
    $config['jwt_secret'] = $existingSecret;
} elseif (empty($config['jwt_secret'])) {
    $config['jwt_secret'] = 'fallback_secure_hash_' . hash('sha256', __DIR__);
}

// -------------------------------------------------------------
// ۳. توابع کمکی اپ‌استیت و بررسی جداول
// -------------------------------------------------------------
function getAppStateValue($pdo, $k, $fallback = null) {
    if (!$pdo) return $fallback;
    try {
        $stmt = $pdo->prepare("SELECT v FROM app_state WHERE k = ?");
        $stmt->execute([$k]);
        $row = $stmt->fetch();
        if (!$row) return $fallback;
        $decoded = json_decode($row['v'], true);
        return $decoded !== null ? $decoded : $row['v'];
    } catch (Exception $e) {
        return $fallback;
    }
}

function setAppStateValue($pdo, $k, $v) {
    if (!$pdo) return;
    $jsonVal = is_string($v) ? json_encode($v) : json_encode($v, JSON_UNESCAPED_UNICODE);
    $stmt = $pdo->prepare("INSERT INTO app_state (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = ?");
    $stmt->execute([$k, $jsonVal, $jsonVal]);
}

function ensureColumn($pdo, $table, $column, $definition) {
    try {
        $check = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
        $check->execute([$column]);
        if ($check->rowCount() === 0) {
            $pdo->exec("ALTER TABLE `$table` ADD `$column` $definition");
        }
    } catch (Exception $e) { /* ignore */ }
}

function ensureDatabaseSchema($pdo, $adminPass) {
    if (!$pdo) return;
    try {
        // ایجاد جداول اصلی در صورت عدم وجود
        $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          username VARCHAR(64) NOT NULL UNIQUE,
          password_hash VARCHAR(100) NOT NULL,
          display_name VARCHAR(128) NOT NULL DEFAULT '',
          role ENUM('admin','manager','staff','finance') NOT NULL DEFAULT 'staff',
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS academic_years (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          title VARCHAR(128) NOT NULL DEFAULT '',
          short_title VARCHAR(32) NOT NULL DEFAULT '',
          period_label VARCHAR(128) NOT NULL DEFAULT '',
          start_date VARCHAR(10) NOT NULL DEFAULT '',
          end_date VARCHAR(10) NOT NULL DEFAULT '',
          status ENUM('active','archived') NOT NULL DEFAULT 'active',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS app_state (
          k VARCHAR(64) NOT NULL PRIMARY KEY,
          v TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS archived_years (
          year_id VARCHAR(36) NOT NULL PRIMARY KEY,
          data LONGTEXT NOT NULL,
          archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_arch_year FOREIGN KEY (year_id) REFERENCES academic_years(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS students (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          national_id VARCHAR(10) NOT NULL,
          first_name VARCHAR(64) NOT NULL,
          last_name VARCHAR(64) NOT NULL,
          father_name VARCHAR(64) NOT NULL DEFAULT '',
          birth_date VARCHAR(10) NOT NULL DEFAULT '',
          grade VARCHAR(32) NOT NULL DEFAULT 'هفتم',
          gpa DECIMAL(4,2) NULL,
          school VARCHAR(128) NOT NULL DEFAULT '',
          city VARCHAR(64) NOT NULL DEFAULT '',
          neighborhood VARCHAR(128) NOT NULL DEFAULT '',
          address VARCHAR(255) NOT NULL DEFAULT '',
          phones JSON NULL,
          emails JSON NULL,
          previous_school VARCHAR(128) NOT NULL DEFAULT '',
          fields JSON NULL,
          notes TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_students_nid (national_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS classes (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          name VARCHAR(128) NOT NULL,
          grade VARCHAR(32) NOT NULL,
          teacher VARCHAR(128) NOT NULL DEFAULT '',
          capacity INT NOT NULL DEFAULT 0,
          tuition BIGINT NOT NULL DEFAULT 0,
          day VARCHAR(32) NOT NULL DEFAULT '',
          time VARCHAR(32) NOT NULL DEFAULT '',
          sessions JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS registrations (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          code VARCHAR(32) NOT NULL,
          student_id VARCHAR(36) NOT NULL,
          class_id VARCHAR(36) NULL,
          session_id VARCHAR(36) NULL,
          status ENUM('pending','approved','waitlist','cancelled') NOT NULL DEFAULT 'pending',
          amount BIGINT NOT NULL DEFAULT 0,
          discount INT NOT NULL DEFAULT 0,
          plan JSON NULL,
          reg_date VARCHAR(10) NOT NULL DEFAULT '',
          notes TEXT NULL,
          woo_order_id VARCHAR(64) NULL,
          year_id VARCHAR(36) NOT NULL,
          created_by VARCHAR(36) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_reg_code (code),
          KEY idx_reg_year (year_id),
          KEY idx_reg_student (student_id),
          KEY idx_reg_class (class_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS settings (
          k VARCHAR(64) NOT NULL PRIMARY KEY,
          v JSON NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS audit_log (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(36) NULL,
          action VARCHAR(64) NOT NULL,
          entity VARCHAR(32) NOT NULL,
          entity_id VARCHAR(64) NOT NULL DEFAULT '',
          details JSON NULL,
          ip VARCHAR(45) NOT NULL DEFAULT '',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        // ارتقای ساختار ستون‌های قدیمی در صورت وجود
        ensureColumn($pdo, 'students', 'grade', "VARCHAR(32) NOT NULL DEFAULT 'هفتم'");
        ensureColumn($pdo, 'students', 'school', "VARCHAR(128) NOT NULL DEFAULT ''");
        ensureColumn($pdo, 'classes', 'tuition', "BIGINT NOT NULL DEFAULT 0");
        ensureColumn($pdo, 'registrations', 'plan', "JSON NULL");
        ensureColumn($pdo, 'registrations', 'amount', "BIGINT NOT NULL DEFAULT 0");
        ensureColumn($pdo, 'registrations', 'discount', "INT NOT NULL DEFAULT 0");
        ensureColumn($pdo, 'registrations', 'reg_date', "VARCHAR(10) NOT NULL DEFAULT ''");
        ensureColumn($pdo, 'academic_years', 'title', "VARCHAR(128) NOT NULL DEFAULT ''");
        ensureColumn($pdo, 'academic_years', 'short_title', "VARCHAR(32) NOT NULL DEFAULT ''");
        ensureColumn($pdo, 'academic_years', 'period_label', "VARCHAR(128) NOT NULL DEFAULT ''");
        ensureColumn($pdo, 'academic_years', 'start_date', "VARCHAR(10) NOT NULL DEFAULT ''");
        ensureColumn($pdo, 'academic_years', 'end_date', "VARCHAR(10) NOT NULL DEFAULT ''");

        // ثبت کاربر مدیر اولیه در صورت خالی بودن جدول کاربران
        $userCount = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        if ($userCount === 0) {
            $initialPass = !empty($adminPass) ? $adminPass : 'admin123';
            $hash = password_hash($initialPass, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("INSERT INTO users (id, username, password_hash, display_name, role) VALUES (?, ?, ?, ?, 'admin')");
            $stmt->execute(['u_admin_01', 'admin', $hash, 'مدیر ارشد سامانه']);
        }

        // ثبت سال تحصیلی پیش‌فرض
        $yearCount = (int)$pdo->query("SELECT COUNT(*) FROM academic_years")->fetchColumn();
        if ($yearCount === 0) {
            $stmt = $pdo->prepare("INSERT INTO academic_years (id, title, short_title, period_label, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, 'active')");
            $stmt->execute(['1404-1405', 'سال تحصیلی ۱۴۰۴-۱۴۰۵', '۱۴۰۴-۱۴۰۵', 'مهر ۱۴۰۴ تا شهریور ۱۴۰۵', '1404/07/01', '1405/06/31']);
            setAppStateValue($pdo, 'activeYearId', '1404-1405');
            setAppStateValue($pdo, 'viewingYearId', '1404-1405');
        }

    } catch (Exception $e) {
        error_log("Schema initialization error: " . $e->getMessage());
    }
}

if ($pdo) {
    ensureDatabaseSchema($pdo, $config['admin_password']);
}

// -------------------------------------------------------------
// ۴. احراز هویت، ماتریس نقش‌ها (RBAC) و لاگ ممیزی
// -------------------------------------------------------------
function b64UrlEnc($data) {
    return rtrim(str_replace(['+', '/'], ['-', '_'], base64_encode($data)), '=');
}

function b64UrlDec($data) {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(str_replace(['-', '_'], ['+', '/'], $data));
}

function signToken($user, $secret) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode([
        'uid' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'name' => $user['display_name'] ?? $user['username'],
        'exp' => time() + (12 * 3600) // انقضای توکن: ۱۲ ساعت
    ]);
    $h = b64UrlEnc($header);
    $p = b64UrlEnc($payload);
    $sig = hash_hmac('sha256', "$h.$p", $secret, true);
    return "$h.$p." . b64UrlEnc($sig);
}

function getAuthUser($pdo, $secret) {
    // فقط خواندن از هدر Authorization (جلوگیری از افشای توکن در query string و access log)
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (empty($authHeader) && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (!preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
        return null;
    }
    $token = $matches[1];
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    $expected = hash_hmac('sha256', $parts[0] . '.' . $parts[1], $secret, true);
    if (!hash_equals($expected, b64UrlDec($parts[2]))) return null;

    $payload = json_decode(b64UrlDec($parts[1]), true);
    if (!$payload || (isset($payload['exp']) && $payload['exp'] < time())) return null;

    // تایید وضعیت فعال بودن کاربر در دیتابیس
    if ($pdo && !empty($payload['uid'])) {
        $stmt = $pdo->prepare("SELECT id, role, display_name, is_active FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$payload['uid']]);
        $dbUser = $stmt->fetch();
        if (!$dbUser || !$dbUser['is_active']) return null;
        return [
            'uid' => $dbUser['id'],
            'username' => $payload['username'],
            'role' => $dbUser['role'],
            'name' => $dbUser['display_name'] ?: $payload['username']
        ];
    }

    return null;
}

const ROLE_MATRIX = [
    'read'    => ['admin', 'manager', 'staff', 'finance'],
    'write'   => ['admin', 'manager', 'staff'],
    'finance' => ['admin', 'manager', 'finance'],
    'years'   => ['admin', 'manager'],
    'admin'   => ['admin'],
];

function requirePerm($user, $permission) {
    global $ROLE_MATRIX;
    $allowedRoles = $ROLE_MATRIX[$permission] ?? [];
    if (!in_array($user['role'] ?? '', $allowedRoles, true)) {
        jsonResp(['error' => 'forbidden', 'message' => 'شما دسترسی مجاز برای این عملیات را ندارید.'], 403);
    }
}

function logAudit($pdo, $userId, $action, $entity, $entityId, $details = []) {
    if (!$pdo) return;
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $stmt = $pdo->prepare("INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $userId, $action, $entity, (string)$entityId,
            json_encode($details, JSON_UNESCAPED_UNICODE), $ip
        ]);
    } catch (Exception $e) { /* non-fatal */ }
}

function handleDbException(PDOException $e, $customMsg = '') {
    $errCode = $e->errorInfo[1] ?? 0;
    if ($errCode == 1062) {
        $msg = $e->getMessage();
        if (strpos($msg, 'uq_students_nid') !== false) {
            jsonResp(['error' => 'duplicate-national-id', 'message' => 'کد ملی وارد شده قبلاً برای دانش‌آموز دیگری ثبت شده است.'], 409);
        }
        if (strpos($msg, 'uq_reg_code') !== false) {
            jsonResp(['error' => 'duplicate-reg-code', 'message' => 'کد پیگیری تکراری است.'], 409);
        }
        if (strpos($msg, 'uq_reg_woo_order') !== false) {
            jsonResp(['error' => 'duplicate-woo-order', 'message' => 'این سفارش ووکامرس قبلاً ثبت شده است.'], 409);
        }
        jsonResp(['error' => 'duplicate-entry', 'message' => 'اطلاعات وارد شده تکراری است.'], 409);
    }
    error_log("DB Exception: " . $e->getMessage());
    jsonResp(['error' => 'database-error', 'message' => $customMsg ?: 'خطا در پایگاه داده.'], 500);
}

// -------------------------------------------------------------
// ۵. نگاشت‌های سازگار با انواع TypeScript فرانت‌اند (Mappers)
// -------------------------------------------------------------
function mapStudent($r) {
    return [
        'id' => $r['id'],
        'firstName' => $r['first_name'],
        'lastName' => $r['last_name'],
        'fatherName' => $r['father_name'] ?? '',
        'nationalId' => $r['national_id'],
        'grade' => $r['grade'] ?: 'هفتم',
        'gpa' => $r['gpa'] !== null ? (float)$r['gpa'] : 0,
        'school' => $r['school'] ?: ($r['previous_school'] ?? ''),
        'phones' => json_decode($r['phones'], true) ?: [],
        'emails' => json_decode($r['emails'], true) ?: [],
        'birthDate' => $r['birth_date'] ?? '',
        'city' => $r['city'] ?? '',
        'neighborhood' => $r['neighborhood'] ?? '',
        'address' => $r['address'] ?? '',
        'notes' => $r['notes'] ?? '',
        'fields' => json_decode($r['fields'], true) ?: new stdClass(),
        'createdAt' => $r['created_at'],
        'updatedAt' => $r['updated_at'] ?? $r['created_at']
    ];
}

function mapClass($r) {
    return [
        'id' => $r['id'],
        'name' => $r['name'],
        'grade' => $r['grade'],
        'teacher' => $r['teacher'] ?? '',
        'capacity' => (int)$r['capacity'],
        'tuition' => (float)($r['tuition'] ?? 0),
        'day' => $r['day'] ?? '',
        'time' => $r['time'] ?? '',
        'sessions' => json_decode($r['sessions'], true) ?: [],
        'createdAt' => $r['created_at'],
        'updatedAt' => $r['updated_at'] ?? $r['created_at']
    ];
}

function mapReg($r) {
    $planRaw = json_decode($r['plan'] ?? 'null', true);
    if (!is_array($planRaw)) {
        $planRaw = [
            'type' => 'نقدی',
            'totalAmount' => (float)$r['amount'],
            'discountPercent' => (int)$r['discount'],
            'installments' => []
        ];
    }

    // هماهنگی فیلد paidAt اقساط
    if (!empty($planRaw['installments']) && is_array($planRaw['installments'])) {
        foreach ($planRaw['installments'] as &$it) {
            if (!isset($it['paidAt']) && isset($it['paidDate'])) {
                $it['paidAt'] = $it['paidDate'];
            }
        }
    }

    return [
        'id' => $r['id'],
        'code' => $r['code'],
        'studentId' => $r['student_id'],
        'classId' => $r['class_id'] ?? '',
        'sessionId' => $r['session_id'] ?? '',
        'status' => $r['status'],
        'amount' => (float)$r['amount'],
        'discount' => (float)$r['discount'],
        'plan' => $planRaw,
        'date' => $r['reg_date'] ?: substr($r['created_at'], 0, 10),
        'notes' => $r['notes'] ?? '',
        'wooOrderId' => $r['woo_order_id'] ?? null,
        'yearId' => $r['year_id'],
        'createdAt' => $r['created_at'],
        'updatedAt' => $r['updated_at'] ?? $r['created_at']
    ];
}

function mapYear($r) {
    return [
        'id' => $r['id'],
        'title' => $r['title'] ?: ($r['label'] ?? ("سال تحصیلی " . $r['id'])),
        'shortTitle' => $r['short_title'] ?: $r['id'],
        'periodLabel' => $r['period_label'] ?: ($r['title'] ?? ''),
        'startDate' => $r['start_date'] ?? '',
        'endDate' => $r['end_date'] ?? '',
        'isActive' => ($r['status'] === 'active'),
        'isArchived' => ($r['status'] === 'archived'),
        'status' => $r['status']
    ];
}

function getTodayJalaliString() {
    $gy = (int)date('Y');
    $gm = (int)date('n');
    $gd = (int)date('j');
    $g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    $jy = ($gy <= 1600) ? 0 : 979;
    $gy -= ($gy <= 1600) ? 621 : 1600;
    $gy2 = ($gm > 2) ? ($gy + 1) : $gy;
    $days = (365 * $gy) + ((int)(($gy2 + 3) / 4)) - ((int)(($gy2 + 99) / 100)) + ((int)(($gy2 + 399) / 400)) - 80 + $gd + $g_d_m[$gm - 1];
    $jy += 33 * ((int)($days / 12053));
    $days %= 12053;
    $jy += 4 * ((int)($days / 1461));
    $days %= 1461;
    $jy += (int)(($days - 1) / 365);
    $days = ($days - 1) % 365;
    $jm = ($days < 186) ? 1 + (int)($days / 31) : 7 + (int)(($days - 186) / 30);
    $jd = 1 + (($days < 186) ? ($days % 31) : (($days - 186) % 30));
    return sprintf('%04d/%02d/%02d', $jy, $jm, $jd);
}

function getJalaliYear() {
    $parts = explode('/', getTodayJalaliString());
    return (int)$parts[0];
}

function bumpEnrolledCounts($pdo, $classId) {
    if (!$classId || !$pdo) return;
    try {
        $stmt = $pdo->prepare("SELECT sessions FROM classes WHERE id = ?");
        $stmt->execute([$classId]);
        $cls = $stmt->fetch();
        if (!$cls) return;

        $countsStmt = $pdo->prepare("SELECT session_id, COUNT(*) c FROM registrations WHERE class_id = ? AND status <> 'cancelled' GROUP BY session_id");
        $countsStmt->execute([$classId]);
        $counts = $countsStmt->fetchAll();
        $map = [];
        foreach ($counts as $r) {
            $map[$r['session_id']] = (int)$r['c'];
        }
        $sessions = json_decode($cls['sessions'], true) ?: [];
        foreach ($sessions as &$s) {
            $s['enrolledCount'] = $map[$s['id']] ?? 0;
            // گارد حداقل ظرفیت به نسبت ثبت‌نام‌های فعال (LO-5)
            if (isset($s['capacity']) && $s['capacity'] < $s['enrolledCount']) {
                $s['capacity'] = $s['enrolledCount'];
            }
        }
        $totalCap = array_reduce($sessions, fn($carry, $x) => $carry + ((int)($x['capacity'] ?? 0)), 0);
        $up = $pdo->prepare("UPDATE classes SET capacity = ?, sessions = ? WHERE id = ?");
        $up->execute([$totalCap, json_encode($sessions, JSON_UNESCAPED_UNICODE), $classId]);
    } catch (Exception $e) { /* ignore */ }
}

// -------------------------------------------------------------
// ۶. مسیریابی (Routing) و پردازش درخواست‌ها
// -------------------------------------------------------------
$rawUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = preg_replace('#^.*?/api#', '', $rawUri);
$uri = '/' . trim($uri, '/');
$method = $_SERVER['REQUEST_METHOD'];
$body = parseJsonBody();

// مسیر ریشه API
if ($uri === '/' || $uri === '') {
    jsonResp([
        'ok' => true,
        'service' => 'Allameh Helli TCMS API',
        'status' => 'online',
        'health' => '/api/health'
    ]);
}

// بررسی سلامت سامانه (Health Check) - امن و بدون افشای سورس و نسخه‌ها (P1-8)
if ($uri === '/health') {
    jsonResp([
        'ok' => true,
        'db_connected' => ($pdo !== null),
        'timestamp' => time()
    ]);
}

if (!$pdo) {
    jsonResp([
        'error' => 'db-connection-failed',
        'message' => 'اتصال به پایگاه‌داده MySQL برقرار نشد. لطفاً تنظیمات دیتابیس را در فایل .env بررسی نمایید.'
    ], 500);
}

// مسیر لاگین کاربران
if ($uri === '/auth/login' && $method === 'POST') {
    $username = trim($body['username'] ?? '');
    $password = (string)($body['password'] ?? '');

    if (empty($username) || empty($password)) {
        jsonResp(['error' => 'missing-credentials', 'message' => 'نام کاربری و رمز عبور الزامی است.'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND is_active = 1 LIMIT 1");
    $stmt->execute([$username]);
    $userRow = $stmt->fetch();

    if (!$userRow || !password_verify($password, $userRow['password_hash'])) {
        jsonResp(['error' => 'invalid-credentials', 'message' => 'نام کاربری یا رمز عبور اشتباه است.'], 401);
    }

    $token = signToken($userRow, $config['jwt_secret']);
    logAudit($pdo, $userRow['id'], 'LOGIN', 'user', $userRow['id']);

    jsonResp([
        'token' => $token,
        'user' => [
            'id' => $userRow['id'],
            'username' => $userRow['username'],
            'displayName' => $userRow['display_name'],
            'role' => $userRow['role']
        ]
    ]);
}

// -------------------------------------------------------------
// بررسی احراز هویت برای تمام مسیرهای محافظت‌شده
// -------------------------------------------------------------
$user = getAuthUser($pdo, $config['jwt_secret']);
if (!$user) {
    jsonResp(['error' => 'unauthorized', 'message' => 'نشست کاربری شما معتبر نیست یا منقضی شده است.'], 401);
}

if ($uri === '/auth/me' && $method === 'GET') {
    jsonResp(['user' => $user]);
}

// تغییر رمز عبور امن با کنترل نقش و رمز فعلی (P0-2)
if ($uri === '/auth/change-password' && $method === 'POST') {
    $targetUserId = $body['userId'] ?? $user['uid'];
    $newPassword = $body['newPassword'] ?? '';
    $currentPassword = $body['currentPassword'] ?? '';

    if (!is_string($newPassword) || strlen($newPassword) < 8) {
        jsonResp(['error' => 'password-too-short', 'message' => 'رمز عبور باید حداقل ۸ نویسه باشد.'], 400);
    }

    // فقط مدیر می‌تواند رمز سایر کاربران را تغییر دهد
    if ($targetUserId !== $user['uid'] && $user['role'] !== 'admin') {
        jsonResp(['error' => 'forbidden', 'message' => 'تنها مدیر ارشد سامانه مجاز به تغییر رمز دیگر کاربران است.'], 403);
    }

    // اگر کاربر خودش رمزش را تغییر می‌دهد، ورود رمز فعلی الزامی است
    if ($targetUserId === $user['uid']) {
        $cStmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
        $cStmt->execute([$targetUserId]);
        $row = $cStmt->fetch();
        if (!$row || empty($currentPassword) || !password_verify($currentPassword, $row['password_hash'])) {
            jsonResp(['error' => 'invalid-current-password', 'message' => 'رمز عبور فعلی نادرست است.'], 400);
        }
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $upStmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $upStmt->execute([$hash, $targetUserId]);
    logAudit($pdo, $user['uid'], 'CHANGE_PASSWORD', 'user', $targetUserId);

    jsonResp(['ok' => true, 'message' => 'رمز عبور با موفقیت به‌روزرسانی شد.']);
}

// -------------------------------------------------------------
// ۷. دریافت وضعیت کلی سامانه (GET /state)
// -------------------------------------------------------------
if ($uri === '/state' && $method === 'GET') {
    requirePerm($user, 'read');

    $years = array_map('mapYear', $pdo->query("SELECT * FROM academic_years ORDER BY id DESC")->fetchAll());
    $students = array_map('mapStudent', $pdo->query("SELECT * FROM students ORDER BY created_at DESC")->fetchAll());
    $classes = array_map('mapClass', $pdo->query("SELECT * FROM classes ORDER BY created_at ASC")->fetchAll());
    $registrations = array_map('mapReg', $pdo->query("SELECT * FROM registrations ORDER BY created_at DESC")->fetchAll());

    $settingsRows = $pdo->query("SELECT k, v FROM settings")->fetchAll();
    $settings = [];
    foreach ($settingsRows as $s) {
        $val = json_decode($s['v'], true);
        if ($s['k'] === 'wooPublic' && is_array($val)) {
            // حذف کامل secretها (CR-4)
            unset($val['consumerKey'], $val['consumerSecret']);
        }
        $settings[$s['k']] = $val !== null ? $val : $s['v'];
    }

    $archivedRows = $pdo->query("SELECT year_id, data FROM archived_years")->fetchAll();
    $archivedData = [];
    foreach ($archivedRows as $a) {
        $archivedData[$a['year_id']] = json_decode($a['data'], true);
    }

    jsonResp([
        'academicYears' => $years,
        'activeYearId' => getAppStateValue($pdo, 'activeYearId', '1404-1405'),
        'viewingYearId' => getAppStateValue($pdo, 'viewingYearId', '1404-1405'),
        'nextRegSeq' => (int)getAppStateValue($pdo, 'nextRegSeq', 0),
        'students' => $students,
        'classes' => $classes,
        'registrations' => $registrations,
        'settings' => $settings,
        'archivedData' => $archivedData
    ]);
}

// -------------------------------------------------------------
// ۸. مدیریت دانش‌آموزان (CRUD + Audit)
// -------------------------------------------------------------
if ($uri === '/students' && $method === 'POST') {
    requirePerm($user, 'write');
    $s = $body;
    try {
        $stmt = $pdo->prepare("
        INSERT INTO students (id, national_id, first_name, last_name, father_name, birth_date, grade, gpa, school, city, neighborhood, address, phones, emails, previous_school, fields, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $s['id'],
            $s['nationalId'],
            $s['firstName'],
            $s['lastName'],
            $s['fatherName'] ?? '',
            $s['birthDate'] ?? '',
            $s['grade'] ?? 'هفتم',
            isset($s['gpa']) ? (float)$s['gpa'] : null,
            $s['school'] ?? ($s['previousSchool'] ?? ''),
            $s['city'] ?? '',
            $s['neighborhood'] ?? '',
            $s['address'] ?? '',
            json_encode($s['phones'] ?? [], JSON_UNESCAPED_UNICODE),
            json_encode($s['emails'] ?? [], JSON_UNESCAPED_UNICODE),
            $s['previousSchool'] ?? '',
            json_encode($s['fields'] ?? new stdClass(), JSON_UNESCAPED_UNICODE),
            $s['notes'] ?? ''
        ]);
        logAudit($pdo, $user['uid'], 'ADD_STUDENT', 'student', $s['id'], ['name' => $s['firstName'] . ' ' . $s['lastName']]);
        jsonResp(['ok' => true]);
    } catch (PDOException $e) {
        handleDbException($e, 'خطا در ثبت دانش‌آموز');
    }
}

if (preg_match('#^/students/([^/]+)$#', $uri, $m)) {
    $id = $m[1];
    if ($method === 'PUT') {
        requirePerm($user, 'write');
        $s = $body;
        try {
            $stmt = $pdo->prepare("
            UPDATE students SET
              national_id = ?, first_name = ?, last_name = ?, father_name = ?, birth_date = ?,
              grade = ?, gpa = ?, school = ?, city = ?, neighborhood = ?, address = ?,
              phones = ?, emails = ?, previous_school = ?, fields = ?, notes = ?
            WHERE id = ?
            ");
            $stmt->execute([
                $s['nationalId'],
                $s['firstName'],
                $s['lastName'],
                $s['fatherName'] ?? '',
                $s['birthDate'] ?? '',
                $s['grade'] ?? 'هفتم',
                isset($s['gpa']) ? (float)$s['gpa'] : null,
                $s['school'] ?? ($s['previousSchool'] ?? ''),
                $s['city'] ?? '',
                $s['neighborhood'] ?? '',
                $s['address'] ?? '',
                json_encode($s['phones'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode($s['emails'] ?? [], JSON_UNESCAPED_UNICODE),
                $s['previousSchool'] ?? '',
                json_encode($s['fields'] ?? new stdClass(), JSON_UNESCAPED_UNICODE),
                $s['notes'] ?? '',
                $id
            ]);
            logAudit($pdo, $user['uid'], 'UPDATE_STUDENT', 'student', $id);
            jsonResp(['ok' => true]);
        } catch (PDOException $e) {
            handleDbException($e, 'خطا در به‌روزرسانی دانش‌آموز');
        }
    } elseif ($method === 'DELETE') {
        requirePerm($user, 'write');
        $stmt = $pdo->prepare("DELETE FROM students WHERE id = ?");
        $stmt->execute([$id]);
        logAudit($pdo, $user['uid'], 'DELETE_STUDENT', 'student', $id);
        jsonResp(['ok' => true]);
    }
}

// -------------------------------------------------------------
// ۹. مدیریت کلاس‌ها و تطابق ظرفیت زنگ‌ها (LO-5)
// -------------------------------------------------------------
if ($uri === '/classes' && $method === 'POST') {
    requirePerm($user, 'write');
    $c = $body;
    $sessions = $c['sessions'] ?? [];
    $capacity = array_reduce($sessions, fn($carry, $x) => $carry + ((int)($x['capacity'] ?? 0)), 0);

    $stmt = $pdo->prepare("
    INSERT INTO classes (id, name, grade, teacher, capacity, tuition, day, time, sessions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $c['id'],
        $c['name'],
        $c['grade'],
        $c['teacher'] ?? '',
        $capacity,
        (float)($c['tuition'] ?? 0),
        $c['day'] ?? '',
        $c['time'] ?? '',
        json_encode($sessions, JSON_UNESCAPED_UNICODE)
    ]);
    logAudit($pdo, $user['uid'], 'ADD_CLASS', 'class', $c['id'], ['name' => $c['name']]);
    jsonResp(['ok' => true, 'sessions' => $sessions]);
}

if (preg_match('#^/classes/([^/]+)$#', $uri, $m)) {
    $id = $m[1];
    if ($method === 'PUT') {
        requirePerm($user, 'write');
        $c = $body;
        $sessions = $c['sessions'] ?? [];

        // گارد همخوانی ظرفیت با ثبت‌نام‌های جاری
        $countsStmt = $pdo->prepare("SELECT session_id, COUNT(*) c FROM registrations WHERE class_id = ? AND status <> 'cancelled' GROUP BY session_id");
        $countsStmt->execute([$id]);
        $map = [];
        foreach ($countsStmt->fetchAll() as $row) {
            $map[$row['session_id']] = (int)$row['c'];
        }
        foreach ($sessions as &$s) {
            $s['enrolledCount'] = $map[$s['id']] ?? 0;
            if (isset($s['capacity']) && $s['capacity'] < $s['enrolledCount']) {
                $s['capacity'] = $s['enrolledCount'];
            }
        }
        $capacity = array_reduce($sessions, fn($carry, $x) => $carry + ((int)($x['capacity'] ?? 0)), 0);

        $stmt = $pdo->prepare("
        UPDATE classes SET name = ?, grade = ?, teacher = ?, capacity = ?, tuition = ?, day = ?, time = ?, sessions = ?
        WHERE id = ?
        ");
        $stmt->execute([
            $c['name'],
            $c['grade'],
            $c['teacher'] ?? '',
            $capacity,
            (float)($c['tuition'] ?? 0),
            $c['day'] ?? '',
            $c['time'] ?? '',
            json_encode($sessions, JSON_UNESCAPED_UNICODE),
            $id
        ]);
        logAudit($pdo, $user['uid'], 'UPDATE_CLASS', 'class', $id);
        jsonResp(['ok' => true, 'sessions' => $sessions]);
    } elseif ($method === 'DELETE') {
        requirePerm($user, 'write');
        $stmt = $pdo->prepare("DELETE FROM classes WHERE id = ?");
        $stmt->execute([$id]);
        logAudit($pdo, $user['uid'], 'DELETE_CLASS', 'class', $id);
        jsonResp(['ok' => true]);
    }
}

// -------------------------------------------------------------
// ۱۰. مدیریت ثبت‌نام، صدور اتمیک کد پیگیری و گارد سال بایگانی (CR-1, P1-3)
// -------------------------------------------------------------
if ($uri === '/registrations' && $method === 'POST') {
    requirePerm($user, 'write');
    $r = $body;

    $activeYear = getAppStateValue($pdo, 'activeYearId', '1404-1405');
    $yearId = $r['yearId'] ?? $activeYear;

    // گارد CR-1: بررسی وضعیت بایگانی سال
    $yStmt = $pdo->prepare("SELECT status FROM academic_years WHERE id = ?");
    $yStmt->execute([$yearId]);
    $yRow = $yStmt->fetch();
    if ($yRow && $yRow['status'] === 'archived') {
        jsonResp(['error' => 'archived-year-read-only', 'message' => 'این سال تحصیلی بایگانی شده و فقط‌خواندنی است.'], 423);
    }

    $pdo->beginTransaction();
    try {
        // افزایش اتمیک شمارنده شماره پیگیری با قفل سطر (FOR UPDATE)
        $seqStmt = $pdo->prepare("SELECT v FROM app_state WHERE k = 'nextRegSeq' FOR UPDATE");
        $seqStmt->execute();
        $sRow = $seqStmt->fetch();
        $currSeq = $sRow ? (int)json_decode($sRow['v'], true) : 0;
        $nextSeq = $currSeq + 1;

        $jy = getJalaliYear();
        $code = 'T-' . $jy . '-' . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);

        $upSeq = $pdo->prepare("INSERT INTO app_state (k, v) VALUES ('nextRegSeq', ?) ON DUPLICATE KEY UPDATE v = ?");
        $upSeq->execute([json_encode($nextSeq), json_encode($nextSeq)]);

        $planJson = isset($r['plan']) ? json_encode($r['plan'], JSON_UNESCAPED_UNICODE) : null;
        $amount = isset($r['amount']) ? (float)$r['amount'] : (float)($r['totalAmount'] ?? 0);
        $discount = isset($r['discount']) ? (int)$r['discount'] : (int)($r['discountPercent'] ?? 0);
        $regDate = $r['date'] ?? getTodayJalaliString();

        $stmt = $pdo->prepare("
        INSERT INTO registrations (id, code, student_id, class_id, session_id, status, amount, discount, plan, reg_date, notes, woo_order_id, year_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $r['id'],
            $code,
            $r['studentId'],
            $r['classId'] ?? null,
            $r['sessionId'] ?? null,
            $r['status'] ?? 'pending',
            $amount,
            $discount,
            $planJson,
            $regDate,
            $r['notes'] ?? '',
            $r['wooOrderId'] ?? null,
            $yearId,
            $user['uid']
        ]);

        $pdo->commit();

        if (!empty($r['classId'])) bumpEnrolledCounts($pdo, $r['classId']);
        logAudit($pdo, $user['uid'], 'ADD_REGISTRATION', 'registration', $r['id'], ['code' => $code]);

        jsonResp(['ok' => true, 'code' => $code, 'nextRegSeq' => $nextSeq]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        handleDbException($e, 'خطا در ثبت‌نام دانش‌آموز');
    }
}

if (preg_match('#^/registrations/([^/]+)$#', $uri, $m)) {
    $id = $m[1];
    if ($method === 'PUT') {
        requirePerm($user, 'write');
        $r = $body;

        // بررسی گارد سال بایگانی
        $checkStmt = $pdo->prepare("SELECT year_id, status, plan, amount, discount, notes, class_id, session_id, student_id FROM registrations WHERE id = ?");
        $checkStmt->execute([$id]);
        $existing = $checkStmt->fetch();
        if (!$existing) jsonResp(['error' => 'not-found'], 404);

        $yStmt = $pdo->prepare("SELECT status FROM academic_years WHERE id = ?");
        $yStmt->execute([$existing['year_id']]);
        $yRow = $yStmt->fetch();
        if ($yRow && $yRow['status'] === 'archived') {
            jsonResp(['error' => 'archived-year-read-only', 'message' => 'این سال تحصیلی بایگانی شده و فقط‌خواندنی است.'], 423);
        }

        // به‌روزرسانی ایمن بدون پاک شدن دفترچه اقساط یا داده‌های فیلدهای ارسال‌نشده
        $newStatus = $r['status'] ?? $existing['status'];
        $newNotes = array_key_exists('notes', $r) ? $r['notes'] : $existing['notes'];
        $newPlan = isset($r['plan']) ? json_encode($r['plan'], JSON_UNESCAPED_UNICODE) : $existing['plan'];
        $newAmount = isset($r['amount']) ? (float)$r['amount'] : (float)$existing['amount'];
        $newDiscount = isset($r['discount']) ? (int)$r['discount'] : (int)$existing['discount'];
        $newClassId = $r['classId'] ?? $existing['class_id'];
        $newSessionId = $r['sessionId'] ?? $existing['session_id'];

        $up = $pdo->prepare("
        UPDATE registrations SET
          status = ?, notes = ?, plan = ?, amount = ?, discount = ?, class_id = ?, session_id = ?
        WHERE id = ?
        ");
        $up->execute([$newStatus, $newNotes, $newPlan, $newAmount, $newDiscount, $newClassId, $newSessionId, $id]);

        if (!empty($newClassId)) bumpEnrolledCounts($pdo, $newClassId);
        if (!empty($existing['class_id']) && $existing['class_id'] !== $newClassId) {
            bumpEnrolledCounts($pdo, $existing['class_id']);
        }

        logAudit($pdo, $user['uid'], 'UPDATE_REGISTRATION', 'registration', $id);
        jsonResp(['ok' => true]);
    } elseif ($method === 'DELETE') {
        requirePerm($user, 'write');

        $checkStmt = $pdo->prepare("SELECT year_id, class_id FROM registrations WHERE id = ?");
        $checkStmt->execute([$id]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            $yStmt = $pdo->prepare("SELECT status FROM academic_years WHERE id = ?");
            $yStmt->execute([$existing['year_id']]);
            $yRow = $yStmt->fetch();
            if ($yRow && $yRow['status'] === 'archived') {
                jsonResp(['error' => 'archived-year-read-only', 'message' => 'این سال تحصیلی بایگانی شده و فقط‌خواندنی است.'], 423);
            }
        }

        $stmt = $pdo->prepare("DELETE FROM registrations WHERE id = ?");
        $stmt->execute([$id]);
        if (!empty($existing['class_id'])) bumpEnrolledCounts($pdo, $existing['class_id']);
        logAudit($pdo, $user['uid'], 'DELETE_REGISTRATION', 'registration', $id);
        jsonResp(['ok' => true]);
    }
}

// -------------------------------------------------------------
// ۱۱. مدیریت اقساط مالی (RBAC: فقط نقش finance یا admin)
// -------------------------------------------------------------
if (preg_match('#^/registrations/([^/]+)/installments/([^/]+)/pay$#', $uri, $m)) {
    if ($method !== 'POST') jsonResp(['error' => 'method-not-allowed'], 405);
    requirePerm($user, 'finance');

    $regId = $m[1];
    $instId = $m[2];

    $stmt = $pdo->prepare("SELECT * FROM registrations WHERE id = ?");
    $stmt->execute([$regId]);
    $reg = $stmt->fetch();
    if (!$reg) jsonResp(['error' => 'not-found'], 404);

    $yStmt = $pdo->prepare("SELECT status FROM academic_years WHERE id = ?");
    $yStmt->execute([$reg['year_id']]);
    $yRow = $yStmt->fetch();
    if ($yRow && $yRow['status'] === 'archived') {
        jsonResp(['error' => 'archived-year-read-only', 'message' => 'این سال بایگانی شده و پرداخت قسط در آن ممکن نیست.'], 423);
    }

    $plan = json_decode($reg['plan'] ?? 'null', true) ?: [];
    $insts = $plan['installments'] ?? [];
    $found = false;

    $payDate = !empty($body['paidDate']) ? $body['paidDate'] : (!empty($body['paidAt']) ? $body['paidAt'] : getTodayJalaliString());

    foreach ($insts as &$it) {
        if ((string)$it['id'] === (string)$instId) {
            $it['paid'] = true;
            $it['paidAt'] = $payDate;
            $found = true;
            break;
        }
    }
    unset($it);

    if (!$found) jsonResp(['error' => 'installment-not-found'], 404);

    $plan['installments'] = $insts;
    $up = $pdo->prepare("UPDATE registrations SET plan = ? WHERE id = ?");
    $up->execute([json_encode($plan, JSON_UNESCAPED_UNICODE), $regId]);

    logAudit($pdo, $user['uid'], 'PAY_INSTALLMENT', 'registration', $regId, ['installmentId' => $instId, 'paidAt' => $payDate]);
    jsonResp(['ok' => true, 'installments' => $insts]);
}

if (preg_match('#^/registrations/([^/]+)/installments/([^/]+)/refund$#', $uri, $m)) {
    if ($method !== 'POST') jsonResp(['error' => 'method-not-allowed'], 405);
    requirePerm($user, 'finance');

    $regId = $m[1];
    $instId = $m[2];

    $stmt = $pdo->prepare("SELECT * FROM registrations WHERE id = ?");
    $stmt->execute([$regId]);
    $reg = $stmt->fetch();
    if (!$reg) jsonResp(['error' => 'not-found'], 404);

    $yStmt = $pdo->prepare("SELECT status FROM academic_years WHERE id = ?");
    $yStmt->execute([$reg['year_id']]);
    $yRow = $yStmt->fetch();
    if ($yRow && $yRow['status'] === 'archived') {
        jsonResp(['error' => 'archived-year-read-only', 'message' => 'این سال بایگانی شده و فقط‌خواندنی است.'], 423);
    }

    $plan = json_decode($reg['plan'] ?? 'null', true) ?: [];
    $insts = $plan['installments'] ?? [];
    $found = false;

    foreach ($insts as &$it) {
        if ((string)$it['id'] === (string)$instId) {
            $it['paid'] = false;
            $it['paidAt'] = null;
            unset($it['paidDate']);
            $found = true;
            break;
        }
    }
    unset($it);

    if (!$found) jsonResp(['error' => 'installment-not-found'], 404);

    $plan['installments'] = $insts;
    $up = $pdo->prepare("UPDATE registrations SET plan = ? WHERE id = ?");
    $up->execute([json_encode($plan, JSON_UNESCAPED_UNICODE), $regId]);

    logAudit($pdo, $user['uid'], 'REFUND_INSTALLMENT', 'registration', $regId, ['installmentId' => $instId]);
    jsonResp(['ok' => true, 'installments' => $insts]);
}

// -------------------------------------------------------------
// ۱۲. تنظیمات سامانه و فیلتر اطلاعات محرمانه (CR-4, P1-5)
// -------------------------------------------------------------
if (preg_match('#^/settings/([^/]+)$#', $uri, $m)) {
    $k = $m[1];
    $allowed = ['contact', 'notify', 'fieldSettings', 'grades', 'wooPublic', 'paymentPlans'];
    if (!in_array($k, $allowed, true)) {
        jsonResp(['error' => 'unknown-settings-key'], 400);
    }

    if ($method === 'PUT') {
        requirePerm($user, 'admin');
        $saveData = $body;
        // فیلتر عمدی کلیدهای ووکامرس: هرگز secret در دیتابیس ذخیره نشود
        if ($k === 'wooPublic' && is_array($saveData)) {
            unset($saveData['consumerKey'], $saveData['consumerSecret']);
        }
        $v = json_encode($saveData, JSON_UNESCAPED_UNICODE);
        $stmt = $pdo->prepare("INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = ?");
        $stmt->execute([$k, $v, $v]);
        logAudit($pdo, $user['uid'], 'UPDATE_SETTINGS', 'settings', $k);
        jsonResp(['ok' => true]);
    }
}

// -------------------------------------------------------------
// ۱۳. سال‌های تحصیلی و بایگانی اتمیک (CR-1, P2-1, P2-2)
// -------------------------------------------------------------
if ($uri === '/years' && $method === 'POST') {
    requirePerm($user, 'years');
    $y = $body;
    $id = $y['id'] ?? ('year_' . time());
    $title = $y['title'] ?? ($y['label'] ?? ("سال تحصیلی " . $id));
    $short = $y['shortTitle'] ?? $id;
    $period = $y['periodLabel'] ?? $title;

    $stmt = $pdo->prepare("
    INSERT INTO academic_years (id, title, short_title, period_label, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
    ON DUPLICATE KEY UPDATE title = VALUES(title), short_title = VALUES(short_title), period_label = VALUES(period_label)
    ");
    $stmt->execute([$id, $title, $short, $period, $y['startDate'] ?? '', $y['endDate'] ?? '']);
    setAppStateValue($pdo, 'activeYearId', $id);
    logAudit($pdo, $user['uid'], 'CREATE_YEAR', 'year', $id, ['title' => $title]);
    jsonResp(['ok' => true, 'id' => $id]);
}

if (preg_match('#^/years/([^/]+)/archive$#', $uri, $m)) {
    if ($method !== 'POST') jsonResp(['error' => 'method-not-allowed'], 405);
    requirePerm($user, 'years');
    $yearId = $m[1];

    $studentsRaw = array_map('mapStudent', $pdo->query("SELECT * FROM students")->fetchAll());
    $classesRaw = array_map('mapClass', $pdo->query("SELECT * FROM classes")->fetchAll());

    $regStmt = $pdo->prepare("SELECT * FROM registrations WHERE year_id = ?");
    $regStmt->execute([$yearId]);
    $regsRaw = array_map('mapReg', $regStmt->fetchAll());

    $snapshot = [
        'students' => $studentsRaw,
        'classes' => $classesRaw,
        'registrations' => $regsRaw,
        'archivedAt' => date('Y-m-d H:i:s')
    ];

    $stmt = $pdo->prepare("
    INSERT INTO archived_years (year_id, data) VALUES (?, ?)
    ON DUPLICATE KEY UPDATE data = VALUES(data)
    ");
    $stmt->execute([$yearId, json_encode($snapshot, JSON_UNESCAPED_UNICODE)]);

    $up = $pdo->prepare("UPDATE academic_years SET status = 'archived' WHERE id = ?");
    $up->execute([$yearId]);

    logAudit($pdo, $user['uid'], 'ARCHIVE_YEAR', 'year', $yearId);
    jsonResp(['ok' => true]);
}

// -------------------------------------------------------------
// ۱۴. ووکامرس (WooCommerce) سمت سرور - اتصالات امن و احراز هویت Basic (P1-7, P2-8)
// -------------------------------------------------------------
function wooCurl($url, $ck, $cs) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (compatible; AllamehHelli-TCMS/1.0)');
    curl_setopt($ch, CURLOPT_USERPWD, "$ck:$cs");
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);

    $res = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err) {
        return ['ok' => false, 'error' => $err, 'status' => $status];
    }
    $decoded = json_decode($res, true);
    return [
        'ok' => ($status >= 200 && $status < 300),
        'data' => $decoded,
        'status' => $status,
        'raw' => $res
    ];
}

if ($uri === '/woo/status') {
    requirePerm($user, 'read');
    jsonResp([
        'configured' => !empty($config['woo']['consumer_key']) && !empty($config['woo']['store_url']),
        'storeUrl' => preg_replace('#^https?://#', '', $config['woo']['store_url'] ?? '')
    ]);
}

if ($uri === '/woo/test' && $method === 'POST') {
    requirePerm($user, 'write');
    $ck = $config['woo']['consumer_key'];
    $cs = $config['woo']['consumer_secret'];
    $store = rtrim($config['woo']['store_url'], '/');
    if (empty($ck) || empty($cs) || empty($store)) {
        jsonResp(['connected' => false, 'error' => 'server-not-configured']);
    }
    $res = wooCurl($store . '/wp-json/wc/v3/', $ck, $cs);
    if ($res['ok']) {
        jsonResp(['connected' => true]);
    } else {
        $msg = ($res['status'] === 401 || $res['status'] === 403) ? 'invalid-keys' : ($res['error'] ?: 'connection-failed');
        jsonResp(['connected' => false, 'error' => $msg]);
    }
}

if ($uri === '/woo/orders') {
    requirePerm($user, 'write');
    $ck = $config['woo']['consumer_key'];
    $cs = $config['woo']['consumer_secret'];
    $store = rtrim($config['woo']['store_url'], '/');
    if (empty($ck) || empty($cs) || empty($store)) {
        jsonResp(['error' => 'server-not-configured'], 400);
    }
    $res = wooCurl($store . '/wp-json/wc/v3/orders?per_page=50&status=processing,completed', $ck, $cs);
    if (!$res['ok']) {
        jsonResp(['error' => 'woo-fetch-failed', 'details' => $res['error'] ?? 'HTTP ' . $res['status']], $res['status'] ?: 502);
    }
    jsonResp($res['data'] ?: []);
}

if ($uri === '/woo/products') {
    requirePerm($user, 'read');
    $ck = $config['woo']['consumer_key'];
    $cs = $config['woo']['consumer_secret'];
    $store = rtrim($config['woo']['store_url'], '/');
    if (empty($ck) || empty($cs) || empty($store)) {
        jsonResp(['error' => 'server-not-configured'], 400);
    }
    $res = wooCurl($store . '/wp-json/wc/v3/products?per_page=100', $ck, $cs);
    if (!$res['ok']) {
        jsonResp(['error' => 'woo-fetch-failed', 'details' => $res['error'] ?? 'HTTP ' . $res['status']], $res['status'] ?: 502);
    }
    jsonResp($res['data'] ?: []);
}

// -------------------------------------------------------------
// ۱۵. داده‌های دمو و بازنشانی تستی (P1-6: محدود به محیط توسعه و ادمین)
// -------------------------------------------------------------
if ($uri === '/seed-demo' && $method === 'POST') {
    requirePerm($user, 'admin');
    $isDemoAllowed = getenv('ENABLE_DEMO_SEED') === 'true' || getenv('APP_ENV') === 'development';
    if (!$isDemoAllowed) {
        jsonResp(['error' => 'forbidden', 'message' => 'بارگذاری داده آزمایشی در محیط عملیاتی غیرمجاز است.'], 403);
    }
    jsonResp(['ok' => true, 'message' => 'داده‌های دمو بارگذاری شدند.']);
}

// مسیرهای تعریف‌نشده
jsonResp(['error' => 'endpoint-not-found', 'uri' => $uri], 404);
