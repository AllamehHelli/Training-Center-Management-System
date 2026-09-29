<?php
/**
 * سیستم ثبت‌نام موسسه علامه حلی - نسخه بک‌اند PHP برای هاست‌های اشتراکی cPanel
 * بدون نیاز به Node.js - سازگار با PHP 7.4 تا 8.3 و دیتابیس MySQL cPanel
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// بارگذاری تنظیمات
$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    $configFile = __DIR__ . '/config.sample.php';
}
$config = require $configFile;

// اتصال به دیتابیس MySQL
try {
    $dsn = "mysql:host={$config['db']['host']};port={$config['db']['port']};dbname={$config['db']['dbname']};charset={$config['db']['charset']}";
    $pdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'db-connection-failed', 'message' => 'لطفاً تنظیمات دیتابیس را در config.php بررسی کنید.']);
    exit;
}

// ساخت خودکار کاربر پیش‌فرض در صورت خالی بودن جدول کاربران
try {
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM users");
    $userCount = $stmt->fetch()['count'] ?? 0;
    if ($userCount == 0) {
        $adminId = bin2hex(random_bytes(16));
        $adminHash = password_hash('admin123', PASSWORD_BCRYPT);
        $insert = $pdo->prepare("INSERT INTO users (id, username, password_hash, display_name, role) VALUES (?, 'admin', ?, 'مدیر سیستم', 'admin')");
        $insert->execute([$adminId, $adminHash]);
    }
} catch (Exception $e) {
    // در صورت وجود نداشتن جداول ممکن است خطا دهد
}

// توابع کمکی JWT بدون نیاز به هیچ کتابخانه جانبی
function b64UrlEnc($data) {
    return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
}
function b64UrlDec($data) {
    return base64_decode(str_replace(['-', '_'], ['+', '/'], $data));
}
function createToken($user, $secret) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode([
        'uid' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'name' => $user['display_name'] ?? $user['username'],
        'exp' => time() + (30 * 24 * 3600) // 30 روز
    ]);
    $h = b64UrlEnc($header);
    $p = b64UrlEnc($payload);
    $sig = hash_hmac('sha256', "$h.$p", $secret, true);
    return "$h.$p." . b64UrlEnc($sig);
}
function getAuthUser($pdo, $secret) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
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

function parseJsonBody() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?: [];
}

function jsonResp($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// تحلیل مسیر
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// حذف پیشوند احتمالی /api یا پوشه‌های والد
$uri = preg_replace('#^.*?/api#', '', $uri);
$uri = '/' . ltrim($uri, '/');
$method = $_SERVER['REQUEST_METHOD'];
$body = parseJsonBody();

// مسیرهای بدون نیاز به احراز هویت
if ($uri === '/health') {
    jsonResp(['ok' => true, 'php_version' => PHP_VERSION, 'ts' => time()]);
}

if ($uri === '/auth/login' && $method === 'POST') {
    $username = trim($body['username'] ?? '');
    $password = (string)($body['password'] ?? '');

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND is_active = 1 LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResp(['error' => 'invalid-credentials'], 401);
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

// از اینجا به بعد نیاز به لاگین دارد
$user = getAuthUser($pdo, $config['jwt_secret']);
if (!$user) {
    jsonResp(['error' => 'unauthorized'], 401);
}

if ($uri === '/auth/me' && $method === 'GET') {
    jsonResp(['user' => $user]);
}

if ($uri === '/auth/change-password' && $method === 'POST') {
    $userId = $body['userId'] ?? '';
    $newPassword = $body['newPassword'] ?? '';
    if (strlen($newPassword) < 8) jsonResp(['error' => 'password-too-short'], 400);
    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $stmt->execute([$hash, $userId]);
    jsonResp(['ok' => true]);
}

// Helper: خواندن و نوشتن app_state
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

// GET /api/state
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

// دانش‌آموزان
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
        if ($e->getCode() == 23000) jsonResp(['error' => 'duplicate-national-id'], 409);
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

// کلاس‌ها
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

// ثبت‌نام‌ها
if ($uri === '/registrations' && $method === 'POST') {
    $r = $body;
    $seq = (int)getAppState($pdo, 'nextRegSeq', 0) + 1;
    $code = $r['code'] ?? ('T-' . date('Y') . '-' . str_pad($seq, 4, '0', STR_PAD_LEFT));
    $stmt = $pdo->prepare("INSERT INTO registrations (id, code, student_id, class_id, session_id, status, plan_type, total_amount, installments, discount_percent, notes, woo_order_id, year_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([
        $r['id'], $code, $r['studentId'], $r['classId'] ?? null, $r['sessionId'] ?? null,
        $r['status'] ?? 'pending', $r['planType'] ?? '', (float)($r['totalAmount'] ?? 0),
        json_encode($r['installments'] ?? [], JSON_UNESCAPED_UNICODE), (int)($r['discountPercent'] ?? 0),
        $r['notes'] ?? '', $r['wooOrderId'] ?? null, $r['yearId'], $user['uid']
    ]);
    setAppState($pdo, 'nextRegSeq', $seq);
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
        jsonResp(['ok' => true]);
    } elseif ($method === 'DELETE') {
        $stmt = $pdo->prepare("DELETE FROM registrations WHERE id = ?");
        $stmt->execute([$id]);
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

// تنظیمات
if (preg_match('#^/settings/([^/]+)$#', $uri, $m)) {
    $k = $m[1];
    if ($method === 'PUT') {
        $v = json_encode($body, JSON_UNESCAPED_UNICODE);
        $stmt = $pdo->prepare("INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = ?");
        $stmt->execute([$k, $v, $v]);
        jsonResp(['ok' => true]);
    }
}

// سال تحصیلی
if ($uri === '/years' && $method === 'POST') {
    $stmt = $pdo->prepare("INSERT INTO academic_years (id, label, status) VALUES (?, ?, 'active')");
    $stmt->execute([$body['id'], $body['label']]);
    setAppState($pdo, 'activeYearId', $body['id']);
    setAppState($pdo, 'viewingYearId', $body['id']);
    jsonResp(['ok' => true]);
}

if ($uri === '/viewing-year' && $method === 'PUT') {
    setAppState($pdo, 'viewingYearId', (string)($body['yearId'] ?? ''));
    jsonResp(['ok' => true]);
}

// ووکامرس
if ($uri === '/woo/status') {
    jsonResp([
        'configured' => !empty($config['woo']['consumer_key']),
        'storeUrl' => $config['woo']['store_url'] ?? ''
    ]);
}

// مسیر ناشناخته
jsonResp(['error' => 'endpoint-not-found', 'uri' => $uri], 404);
