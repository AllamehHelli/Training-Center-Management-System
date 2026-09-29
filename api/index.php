<?php
/**
 * سیستم ثبت‌نام موسسه تیزهوشان علامه حلی
 * بک‌اند جامع و یکپارچه PHP برای هاست‌های اشتراکی cPanel بدون نیاز به Node.js
 * سازگار با PHP 7.4 تا 8.4+ و MySQL / MariaDB در محیط cPanel
 */

// تنظیم هدرهای اصلی و CORS
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// -------------------------------------------------------------
// ۱. لودر خودکار فایل‌های .env در دایرکتوری‌های والد یا جاری
// -------------------------------------------------------------
function loadEnvVariables() {
    $possiblePaths = [
        __DIR__ . '/.env',
        __DIR__ . '/../.env',
        __DIR__ . '/../../.env',
        dirname(__DIR__, 2) . '/.env',
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

// بارگذاری فایل پیکربندی دستی در صورت وجود
$config = [
    'db' => [
        'host' => getenv('DB_HOST') ?: ($env['DB_HOST'] ?? 'localhost'),
        'port' => getenv('DB_PORT') ?: ($env['DB_PORT'] ?? '3306'),
        'dbname' => getenv('DB_NAME') ?: ($env['DB_NAME'] ?? ''),
        'user' => getenv('DB_USER') ?: ($env['DB_USER'] ?? ''),
        'pass' => getenv('DB_PASS') ?: ($env['DB_PASS'] ?? ''),
        'charset' => 'utf8mb4'
    ],
    'jwt_secret' => getenv('JWT_SECRET') ?: ($env['JWT_SECRET'] ?? 'helli_secure_jwt_token_secret_key_1404'),
    'woo' => [
        'store_url' => getenv('WOO_STORE_URL') ?: ($env['WOO_STORE_URL'] ?? ''),
        'consumer_key' => getenv('WOO_CONSUMER_KEY') ?: ($env['WOO_CONSUMER_KEY'] ?? ''),
        'consumer_secret' => getenv('WOO_CONSUMER_SECRET') ?: ($env['WOO_CONSUMER_SECRET'] ?? ''),
    ],
    'admin_password' => getenv('ADMIN_PASSWORD') ?: ($env['ADMIN_PASSWORD'] ?? 'admin123')
];

if (file_exists(__DIR__ . '/config.php')) {
    $manualConfig = require __DIR__ . '/config.php';
    if (is_array($manualConfig)) {
        $config = array_replace_recursive($config, $manualConfig);
    }
}

function jsonResp($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function parseJsonBody() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?: [];
}

// -------------------------------------------------------------
// ۲. اتصال به پایگاه‌داده MySQL و راه‌اندازی خودکار جداول
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
    }
}

/**
 * ایجاد خودکار ساختار جداول پایگاه داده در صورت خالی بودن دیتابیس
 */
function ensureDatabaseSchema($pdo, $adminPass) {
    if (!$pdo) return;
    try {
        $check = $pdo->query("SHOW TABLES LIKE 'users'");
        if ($check->rowCount() === 0) {
            $sql = "
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
              label VARCHAR(64) NOT NULL,
              status ENUM('active','archived') NOT NULL DEFAULT 'active'
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
              city VARCHAR(64) NOT NULL DEFAULT '',
              neighborhood VARCHAR(128) NOT NULL DEFAULT '',
              address VARCHAR(255) NOT NULL DEFAULT '',
              phones JSON NULL,
              emails JSON NULL,
              previous_school VARCHAR(128) NOT NULL DEFAULT '',
              gpa DECIMAL(4,2) NULL,
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
              day VARCHAR(32) NOT NULL DEFAULT '',
              time VARCHAR(32) NOT NULL DEFAULT '',
              sessions JSON NULL,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS registrations (
              id VARCHAR(36) NOT NULL PRIMARY KEY,
              code VARCHAR(20) NOT NULL,
              student_id VARCHAR(36) NOT NULL,
              class_id VARCHAR(36) NULL,
              session_id VARCHAR(36) NULL,
              status ENUM('pending','approved','waitlist','cancelled') NOT NULL DEFAULT 'pending',
              plan_type VARCHAR(32) NOT NULL DEFAULT '',
              total_amount BIGINT NOT NULL DEFAULT 0,
              installments JSON NULL,
              discount_percent INT NOT NULL DEFAULT 0,
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

            CREATE TABLE IF NOT EXISTS woo_review_queue (
              id BIGINT AUTO_INCREMENT PRIMARY KEY,
              order_id VARCHAR(64) NOT NULL,
              payload JSON NOT NULL,
              reason VARCHAR(255) NOT NULL,
              status ENUM('pending','resolved','rejected') NOT NULL DEFAULT 'pending',
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY uq_queue_order (order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ";

            $pdo->exec($sql);
        }

        // کاربر مدیر پیش‌فرض
        $userCheck = $pdo->query("SELECT COUNT(*) as c FROM users")->fetch();
        if (($userCheck['c'] ?? 0) == 0) {
            $adminId = bin2hex(random_bytes(16));
            $hash = password_hash($adminPass, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("INSERT INTO users (id, username, password_hash, display_name, role) VALUES (?, 'admin', ?, 'مدیر سیستم', 'admin')");
            $stmt->execute([$adminId, $hash]);
        }

        // مقداردهی اولیه وضعیت سامانه
        $stateCheck = $pdo->query("SELECT COUNT(*) as c FROM app_state")->fetch();
        if (($stateCheck['c'] ?? 0) == 0) {
            $pdo->exec("INSERT IGNORE INTO app_state (k, v) VALUES ('activeYearId', '\"1403-1404\"'), ('viewingYearId', '\"1403-1404\"'), ('nextRegSeq', '0')");
        }

        // سال تحصیلی پیش‌فرض
        $yearCheck = $pdo->query("SELECT COUNT(*) as c FROM academic_years")->fetch();
        if (($yearCheck['c'] ?? 0) == 0) {
            $pdo->exec("INSERT IGNORE INTO academic_years (id, label, status) VALUES ('1403-1404', 'سال تحصیلی ۱۴۰۳-۱۴۰۴', 'active')");
        }
    } catch (Exception $e) {
        // نادیده گرفتن خطاهای احتمالی
    }
}

if ($pdo) {
    ensureDatabaseSchema($pdo, $config['admin_password']);
}

// -------------------------------------------------------------
// ۳. سیستم احراز هویت و تولید JWT بدون وابستگی خارجی
// -------------------------------------------------------------
function b64UrlEnc($data) {
    return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
}
function b64UrlDec($data) {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(str_replace(['-', '_'], ['+', '/'], $data));
}
function createToken($user, $secret) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode([
        'uid' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'name' => $user['display_name'] ?? $user['username'],
        'exp' => time() + (30 * 24 * 3600) // ۳۰ روز اعتبار نشست
    ]);
    $h = b64UrlEnc($header);
    $p = b64UrlEnc($payload);
    $sig = hash_hmac('sha256', "$h.$p", $secret, true);
    return "$h.$p." . b64UrlEnc($sig);
}
function getAuthUser($secret) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (empty($authHeader) && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (empty($authHeader) && isset($_GET['token'])) {
        $authHeader = 'Bearer ' . $_GET['token'];
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
    return $payload;
}

// -------------------------------------------------------------
// ۴. پردازش مسیرهای درخواست (Routing)
// -------------------------------------------------------------
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// حذف پیشوند احتمالی پوشه یا /api
$uri = preg_replace('#^.*?/api#', '', $uri);
$uri = '/' . trim($uri, '/');
$method = $_SERVER['REQUEST_METHOD'];
$body = parseJsonBody();

if ($uri === '/' || $uri === '') {
    jsonResp([
        'ok' => true,
        'service' => 'Allameh Helli TCMS API',
        'status' => 'online',
        'health' => '/api/health'
    ]);
}

// مسیر بررسی وضعیت سلامتی سیستم (Health Check)
if ($uri === '/health') {
    jsonResp([
        'ok' => true,
        'php_version' => PHP_VERSION,
        'db_connected' => ($pdo !== null),
        'db_error' => $dbError,
        'ts' => time(),
        'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'cPanel Apache'
    ]);
}

// اگر دیتابیس متصل نشده باشد
if (!$pdo) {
    jsonResp([
        'error' => 'db-connection-failed',
        'message' => 'اتصال به دیتابیس MySQL برقرار نشد. لطفاً مقادیر دیتابیس را در فایل .env یا config.php بررسی نمایید.',
        'details' => $dbError
    ], 500);
}

// لاگین کاربران
if ($uri === '/auth/login' && $method === 'POST') {
    $username = trim($body['username'] ?? '');
    $password = (string)($body['password'] ?? '');

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND is_active = 1 LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResp(['error' => 'invalid-credentials', 'message' => 'نام کاربری یا رمز عبور اشتباه است.'], 401);
    }

    $token = createToken($user, $config['jwt_secret']);
    jsonResp([
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'displayName' => $user['display_name'],
            'role' => $user['role']
        ]
    ]);
}

// بررسی احراز هویت برای تمام مسیرهای بعدی
$user = getAuthUser($config['jwt_secret']);
if (!$user) {
    jsonResp(['error' => 'unauthorized', 'message' => 'لطفاً وارد سامانه شوید.'], 401);
}

if ($uri === '/auth/me' && $method === 'GET') {
    jsonResp(['user' => $user]);
}

if ($uri === '/auth/change-password' && $method === 'POST') {
    $userId = $body['userId'] ?? $user['uid'];
    $newPassword = $body['newPassword'] ?? '';
    if (strlen($newPassword) < 6) jsonResp(['error' => 'password-too-short', 'message' => 'رمز عبور باید حداقل ۶ نویسه باشد.'], 400);
    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $stmt->execute([$hash, $userId]);
    jsonResp(['ok' => true]);
}

// توابع کمکی وضعیت سامانه
function getAppState($pdo, $k, $fallback = '') {
    $stmt = $pdo->prepare("SELECT v FROM app_state WHERE k = ?");
    $stmt->execute([$k]);
    $row = $stmt->fetch();
    if (!$row) return $fallback;
    $v = json_decode($row['v'], true);
    return $v !== null ? $v : $row['v'];
}
function setAppState($pdo, $k, $v) {
    $jsonVal = is_string($v) ? json_encode($v) : json_encode($v, JSON_UNESCAPED_UNICODE);
    $stmt = $pdo->prepare("INSERT INTO app_state (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = ?");
    $stmt->execute([$k, $jsonVal, $jsonVal]);
}

function bumpEnrolledCounts($pdo, $classId) {
    if (!$classId) return;
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
    }
    $up = $pdo->prepare("UPDATE classes SET sessions = ? WHERE id = ?");
    $up->execute([json_encode($sessions, JSON_UNESCAPED_UNICODE), $classId]);
}

function getJalaliYear() {
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
    return $jy;
}

// -------------------------------------------------------------
// ۵. مسیرهای اصلی اپلیکیشن: GET /api/state
// -------------------------------------------------------------
if ($uri === '/state' && $method === 'GET') {
    $years = $pdo->query("SELECT id, label, status FROM academic_years")->fetchAll();
    $studentsRaw = $pdo->query("SELECT * FROM students ORDER BY created_at DESC")->fetchAll();
    $classesRaw = $pdo->query("SELECT * FROM classes ORDER BY created_at ASC")->fetchAll();
    $regRaw = $pdo->query("SELECT * FROM registrations ORDER BY created_at DESC")->fetchAll();
    $settingsRaw = $pdo->query("SELECT k, v FROM settings")->fetchAll();
    $archivedRaw = $pdo->query("SELECT year_id, data FROM archived_years")->fetchAll();

    $settings = [];
    foreach ($settingsRaw as $s) {
        $settings[$s['k']] = json_decode($s['v'], true) ?: [];
    }
    unset($settings['woo']['consumerKey'], $settings['woo']['consumerSecret']);

    $students = array_map(function($r) {
        return [
            'id' => $r['id'],
            'nationalId' => $r['national_id'],
            'firstName' => $r['first_name'],
            'lastName' => $r['last_name'],
            'fatherName' => $r['father_name'] ?: '',
            'birthDate' => $r['birth_date'] ?: '',
            'city' => $r['city'] ?: '',
            'neighborhood' => $r['neighborhood'] ?: '',
            'address' => $r['address'] ?: '',
            'phones' => json_decode($r['phones'], true) ?: [],
            'emails' => json_decode($r['emails'], true) ?: [],
            'previousSchool' => $r['previous_school'] ?: '',
            'gpa' => $r['gpa'] !== null ? (float)$r['gpa'] : null,
            'fields' => json_decode($r['fields'], true) ?: new stdClass(),
            'notes' => $r['notes'] ?: '',
            'createdAt' => $r['created_at'],
            'updatedAt' => $r['updated_at']
        ];
    }, $studentsRaw);

    $classes = array_map(function($r) {
        return [
            'id' => $r['id'],
            'name' => $r['name'],
            'grade' => $r['grade'],
            'teacher' => $r['teacher'] ?: '',
            'capacity' => (int)$r['capacity'],
            'day' => $r['day'] ?: '',
            'time' => $r['time'] ?: '',
            'sessions' => json_decode($r['sessions'], true) ?: [],
            'createdAt' => $r['created_at'],
            'updatedAt' => $r['updated_at']
        ];
    }, $classesRaw);

    $registrations = array_map(function($r) {
        return [
            'id' => $r['id'],
            'code' => $r['code'],
            'studentId' => $r['student_id'],
            'classId' => $r['class_id'],
            'sessionId' => $r['session_id'],
            'status' => $r['status'],
            'planType' => $r['plan_type'] ?: '',
            'totalAmount' => (float)$r['total_amount'],
            'installments' => json_decode($r['installments'], true) ?: [],
            'discountPercent' => (int)$r['discount_percent'],
            'notes' => $r['notes'] ?: '',
            'wooOrderId' => $r['woo_order_id'],
            'yearId' => $r['year_id'],
            'createdAt' => $r['created_at'],
            'updatedAt' => $r['updated_at']
        ];
    }, $regRaw);

    $archivedData = [];
    foreach ($archivedRaw as $a) {
        $archivedData[$a['year_id']] = json_decode($a['data'], true);
    }

    jsonResp([
        'academicYears' => $years,
        'activeYearId' => getAppState($pdo, 'activeYearId', ''),
        'viewingYearId' => getAppState($pdo, 'viewingYearId', ''),
        'nextRegSeq' => (int)getAppState($pdo, 'nextRegSeq', 0),
        'students' => $students,
        'classes' => $classes,
        'registrations' => $registrations,
        'settings' => $settings,
        'archivedData' => $archivedData
    ]);
}

// -------------------------------------------------------------
// ۶. مدیریت دانش‌آموزان
// -------------------------------------------------------------
if ($uri === '/students' && $method === 'POST') {
    $s = $body;
    try {
        $stmt = $pdo->prepare("INSERT INTO students (id, national_id, first_name, last_name, father_name, birth_date, city, neighborhood, address, phones, emails, previous_school, gpa, fields, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $s['id'], $s['nationalId'], $s['firstName'], $s['lastName'], $s['fatherName'] ?? '',
            $s['birthDate'] ?? '', $s['city'] ?? '', $s['neighborhood'] ?? '', $s['address'] ?? '',
            json_encode($s['phones'] ?? []), json_encode($s['emails'] ?? []), $s['previousSchool'] ?? '',
            isset($s['gpa']) ? (float)$s['gpa'] : null, json_encode($s['fields'] ?? new stdClass()), $s['notes'] ?? ''
        ]);
        jsonResp(['ok' => true]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) jsonResp(['error' => 'duplicate-national-id', 'message' => 'کد ملی وارد شده قبلاً ثبت شده است.'], 409);
        throw $e;
    }
}

if (preg_match('#^/students/([^/]+)$#', $uri, $m)) {
    $id = $m[1];
    if ($method === 'PUT') {
        $s = $body;
        $stmt = $pdo->prepare("UPDATE students SET national_id=?, first_name=?, last_name=?, father_name=?, birth_date=?, city=?, neighborhood=?, address=?, phones=?, emails=?, previous_school=?, gpa=?, fields=?, notes=? WHERE id=?");
        $stmt->execute([
            $s['nationalId'], $s['firstName'], $s['lastName'], $s['fatherName'] ?? '',
            $s['birthDate'] ?? '', $s['city'] ?? '', $s['neighborhood'] ?? '', $s['address'] ?? '',
            json_encode($s['phones'] ?? []), json_encode($s['emails'] ?? []), $s['previousSchool'] ?? '',
            isset($s['gpa']) ? (float)$s['gpa'] : null, json_encode($s['fields'] ?? new stdClass()), $s['notes'] ?? '', $id
        ]);
        jsonResp(['ok' => true]);
    } elseif ($method === 'DELETE') {
        $stmt = $pdo->prepare("DELETE FROM students WHERE id = ?");
        $stmt->execute([$id]);
        jsonResp(['ok' => true]);
    }
}

// -------------------------------------------------------------
// ۷. مدیریت کلاس‌ها
// -------------------------------------------------------------
if ($uri === '/classes' && $method === 'POST') {
    $c = $body;
    $sessions = $c['sessions'] ?? [];
    $capacity = array_reduce($sessions, fn($carry, $x) => $carry + ((int)($x['capacity'] ?? 0)), 0);
    $stmt = $pdo->prepare("INSERT INTO classes (id, name, grade, teacher, capacity, day, time, sessions) VALUES (?,?,?,?,?,?,?,?)");
    $stmt->execute([
        $c['id'], $c['name'], $c['grade'], $c['teacher'] ?? '',
        $capacity, $c['day'] ?? '', $c['time'] ?? '', json_encode($sessions, JSON_UNESCAPED_UNICODE)
    ]);
    jsonResp(['ok' => true, 'sessions' => $sessions]);
}

if (preg_match('#^/classes/([^/]+)$#', $uri, $m)) {
    $id = $m[1];
    if ($method === 'PUT') {
        $c = $body;
        $sessions = $c['sessions'] ?? [];
        $capacity = array_reduce($sessions, fn($carry, $x) => $carry + ((int)($x['capacity'] ?? 0)), 0);
        $stmt = $pdo->prepare("UPDATE classes SET name=?, grade=?, teacher=?, capacity=?, day=?, time=?, sessions=? WHERE id=?");
        $stmt->execute([
            $c['name'], $c['grade'], $c['teacher'] ?? '',
            $capacity, $c['day'] ?? '', $c['time'] ?? '', json_encode($sessions, JSON_UNESCAPED_UNICODE), $id
        ]);
        jsonResp(['ok' => true, 'sessions' => $sessions]);
    } elseif ($method === 'DELETE') {
        $stmt = $pdo->prepare("DELETE FROM classes WHERE id = ?");
        $stmt->execute([$id]);
        jsonResp(['ok' => true]);
    }
}

// -------------------------------------------------------------
// ۸. مدیریت ثبت‌نام‌ها و صدور کدهای پیگیری
// -------------------------------------------------------------
if ($uri === '/registrations' && $method === 'POST') {
    $r = $body;
    $jy = getJalaliYear();
    $seq = (int)getAppState($pdo, 'nextRegSeq', 0) + 1;
    $code = $r['code'] ?? ('T-' . $jy . '-' . str_pad($seq, 4, '0', STR_PAD_LEFT));

    $stmt = $pdo->prepare("INSERT INTO registrations (id, code, student_id, class_id, session_id, status, plan_type, total_amount, installments, discount_percent, notes, woo_order_id, year_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([
        $r['id'], $code, $r['studentId'], $r['classId'] ?? null, $r['sessionId'] ?? null,
        $r['status'] ?? 'pending', $r['planType'] ?? '', (float)($r['totalAmount'] ?? 0),
        json_encode($r['installments'] ?? [], JSON_UNESCAPED_UNICODE), (int)($r['discountPercent'] ?? 0),
        $r['notes'] ?? '', $r['wooOrderId'] ?? null, $r['yearId'], $user['uid']
    ]);
    setAppState($pdo, 'nextRegSeq', $seq);
    if (!empty($r['classId'])) bumpEnrolledCounts($pdo, $r['classId']);
    jsonResp(['ok' => true, 'code' => $code, 'nextRegSeq' => $seq]);
}

if (preg_match('#^/registrations/([^/]+)$#', $uri, $m)) {
    $id = $m[1];
    if ($method === 'PUT') {
        $r = $body;
        $stmt = $pdo->prepare("UPDATE registrations SET student_id=?, class_id=?, session_id=?, status=?, plan_type=?, total_amount=?, installments=?, discount_percent=?, notes=? WHERE id=?");
        $stmt->execute([
            $r['studentId'], $r['classId'] ?? null, $r['sessionId'] ?? null, $r['status'],
            $r['planType'] ?? '', (float)($r['totalAmount'] ?? 0),
            json_encode($r['installments'] ?? [], JSON_UNESCAPED_UNICODE),
            (int)($r['discountPercent'] ?? 0), $r['notes'] ?? '', $id
        ]);
        if (!empty($r['classId'])) bumpEnrolledCounts($pdo, $r['classId']);
        jsonResp(['ok' => true]);
    } elseif ($method === 'DELETE') {
        $check = $pdo->prepare("SELECT class_id FROM registrations WHERE id = ?");
        $check->execute([$id]);
        $row = $check->fetch();
        $stmt = $pdo->prepare("DELETE FROM registrations WHERE id = ?");
        $stmt->execute([$id]);
        if (!empty($row['class_id'])) bumpEnrolledCounts($pdo, $row['class_id']);
        jsonResp(['ok' => true]);
    }
}

// پرداخت قسط
if (preg_match('#^/registrations/([^/]+)/installments/([^/]+)/pay$#', $uri, $m)) {
    $regId = $m[1];
    $instId = $m[2];
    $stmt = $pdo->prepare("SELECT installments FROM registrations WHERE id = ?");
    $stmt->execute([$regId]);
    $row = $stmt->fetch();
    if (!$row) jsonResp(['error' => 'not-found'], 404);
    $insts = json_decode($row['installments'], true) ?: [];
    foreach ($insts as &$it) {
        if ($it['id'] === $instId) {
            $it['paid'] = true;
            $it['paidDate'] = $body['paidDate'] ?? date('Y-m-d');
        }
    }
    $up = $pdo->prepare("UPDATE registrations SET installments = ? WHERE id = ?");
    $up->execute([json_encode($insts, JSON_UNESCAPED_UNICODE), $regId]);
    jsonResp(['ok' => true, 'installments' => $insts]);
}

// عودت/لغو پرداخت قسط (Refund)
if (preg_match('#^/registrations/([^/]+)/installments/([^/]+)/refund$#', $uri, $m)) {
    $regId = $m[1];
    $instId = $m[2];
    $stmt = $pdo->prepare("SELECT installments FROM registrations WHERE id = ?");
    $stmt->execute([$regId]);
    $row = $stmt->fetch();
    if (!$row) jsonResp(['error' => 'not-found'], 404);
    $insts = json_decode($row['installments'], true) ?: [];
    foreach ($insts as &$it) {
        if ($it['id'] === $instId) {
            $it['paid'] = false;
            unset($it['paidDate']);
        }
    }
    $up = $pdo->prepare("UPDATE registrations SET installments = ? WHERE id = ?");
    $up->execute([json_encode($insts, JSON_UNESCAPED_UNICODE), $regId]);
    jsonResp(['ok' => true, 'installments' => $insts]);
}

// -------------------------------------------------------------
// ۹. تنظیمات و سال‌های تحصیلی
// -------------------------------------------------------------
if (preg_match('#^/settings/([^/]+)$#', $uri, $m)) {
    $k = $m[1];
    if ($method === 'PUT') {
        $v = json_encode($body, JSON_UNESCAPED_UNICODE);
        $stmt = $pdo->prepare("INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = ?");
        $stmt->execute([$k, $v, $v]);
        jsonResp(['ok' => true]);
    }
}

if ($uri === '/years' && $method === 'POST') {
    $stmt = $pdo->prepare("INSERT INTO academic_years (id, label, status) VALUES (?, ?, 'active')");
    $stmt->execute([$body['id'], $body['label']]);
    setAppState($pdo, 'activeYearId', $body['id']);
    setAppState($pdo, 'viewingYearId', $body['id']);
    jsonResp(['ok' => true]);
}

if (preg_match('#^/years/([^/]+)/archive$#', $uri, $m)) {
    $yearId = $m[1];
    $studentsRaw = $pdo->query("SELECT * FROM students")->fetchAll();
    $classesRaw = $pdo->query("SELECT * FROM classes")->fetchAll();
    $regStmt = $pdo->prepare("SELECT * FROM registrations WHERE year_id = ?");
    $regStmt->execute([$yearId]);
    $regRaw = $regStmt->fetchAll();

    $snapshot = [
        'students' => $studentsRaw,
        'classes' => $classesRaw,
        'registrations' => $regRaw
    ];
    $jsonSnapshot = json_encode($snapshot, JSON_UNESCAPED_UNICODE);

    $upArchive = $pdo->prepare("INSERT INTO archived_years (year_id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?");
    $upArchive->execute([$yearId, $jsonSnapshot, $jsonSnapshot]);

    $upYear = $pdo->prepare("UPDATE academic_years SET status = 'archived' WHERE id = ?");
    $upYear->execute([$yearId]);

    jsonResp(['ok' => true]);
}

if ($uri === '/viewing-year' && $method === 'PUT') {
    setAppState($pdo, 'viewingYearId', (string)($body['yearId'] ?? ''));
    jsonResp(['ok' => true]);
}

// -------------------------------------------------------------
// ۱۰. ووکامرس (WooCommerce) سمت سرور
// -------------------------------------------------------------
function wooCurl($url, $ck, $cs) {
    $sep = strpos($url, '?') !== false ? '&' : '?';
    $fullUrl = $url . $sep . 'consumer_key=' . urlencode($ck) . '&consumer_secret=' . urlencode($cs);
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $fullUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
    $res = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) {
        return ['ok' => false, 'error' => $err, 'status' => $status];
    }
    return ['ok' => ($status >= 200 && $status < 300), 'data' => json_decode($res, true), 'status' => $status, 'raw' => $res];
}

if ($uri === '/woo/status') {
    jsonResp([
        'configured' => !empty($config['woo']['consumer_key']) && !empty($config['woo']['store_url']),
        'storeUrl' => preg_replace('#^https?://#', '', $config['woo']['store_url'] ?? '')
    ]);
}

if ($uri === '/woo/test' && $method === 'POST') {
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
    $ck = $config['woo']['consumer_key'];
    $cs = $config['woo']['consumer_secret'];
    $store = rtrim($config['woo']['store_url'], '/');
    if (empty($ck) || empty($cs) || empty($store)) {
        jsonResp(['error' => 'server-not-configured'], 400);
    }
    $res = wooCurl($store . '/wp-json/wc/v3/orders?per_page=50&status=processing,completed', $ck, $cs);
    jsonResp($res['data'] ?: []);
}

if ($uri === '/woo/products') {
    $ck = $config['woo']['consumer_key'];
    $cs = $config['woo']['consumer_secret'];
    $store = rtrim($config['woo']['store_url'], '/');
    if (empty($ck) || empty($cs) || empty($store)) {
        jsonResp(['error' => 'server-not-configured'], 400);
    }
    $res = wooCurl($store . '/wp-json/wc/v3/products?per_page=100', $ck, $cs);
    jsonResp($res['data'] ?: []);
}

// -------------------------------------------------------------
// ۱۱. ورود داده‌های نمونه اولیه یا بازیابی بک‌آپ (Seed / Restore)
// -------------------------------------------------------------
if ($uri === '/seed-demo' && $method === 'POST') {
    $data = $body;
    if (!empty($data['students'])) {
        foreach ($data['students'] as $s) {
            $stmt = $pdo->prepare("INSERT INTO students (id, national_id, first_name, last_name, father_name, birth_date, city, neighborhood, address, phones, emails, previous_school, gpa, fields, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), last_name=VALUES(last_name)");
            $stmt->execute([
                $s['id'], $s['nationalId'], $s['firstName'], $s['lastName'], $s['fatherName'] ?? '',
                $s['birthDate'] ?? '', $s['city'] ?? '', $s['neighborhood'] ?? '', $s['address'] ?? '',
                json_encode($s['phones'] ?? []), json_encode($s['emails'] ?? []), $s['previousSchool'] ?? '',
                isset($s['gpa']) ? (float)$s['gpa'] : null, json_encode($s['fields'] ?? new stdClass()), $s['notes'] ?? ''
            ]);
        }
    }
    if (!empty($data['classes'])) {
        foreach ($data['classes'] as $c) {
            $sessions = $c['sessions'] ?? [];
            $capacity = array_reduce($sessions, fn($carry, $x) => $carry + ((int)($x['capacity'] ?? 0)), 0);
            $stmt = $pdo->prepare("INSERT INTO classes (id, name, grade, teacher, capacity, day, time, sessions) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), sessions=VALUES(sessions)");
            $stmt->execute([
                $c['id'], $c['name'], $c['grade'], $c['teacher'] ?? '',
                $capacity, $c['day'] ?? '', $c['time'] ?? '', json_encode($sessions, JSON_UNESCAPED_UNICODE)
            ]);
        }
    }
    if (!empty($data['registrations'])) {
        foreach ($data['registrations'] as $r) {
            $stmt = $pdo->prepare("INSERT INTO registrations (id, code, student_id, class_id, session_id, status, plan_type, total_amount, installments, discount_percent, notes, woo_order_id, year_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status)");
            $stmt->execute([
                $r['id'], $r['code'], $r['studentId'], $r['classId'] ?? null, $r['sessionId'] ?? null,
                $r['status'] ?? 'pending', $r['planType'] ?? '', (float)($r['totalAmount'] ?? 0),
                json_encode($r['installments'] ?? [], JSON_UNESCAPED_UNICODE), (int)($r['discountPercent'] ?? 0),
                $r['notes'] ?? '', $r['wooOrderId'] ?? null, $r['yearId'] ?? '1403-1404', $user['uid']
            ]);
        }
    }
    jsonResp(['ok' => true, 'message' => 'داده‌ها با موفقیت ایمپورت شدند.']);
}

// مسیرهای تعریف نشده
jsonResp(['error' => 'endpoint-not-found', 'uri' => $uri], 404);
