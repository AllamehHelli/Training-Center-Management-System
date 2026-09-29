<?php
/**
 * پیکربندی دیتابیس و تنظیمات بک‌اند PHP برای هاست‌های cPanel
 * این فایل را به config.php تغییر نام دهید یا مقادیر دیتابیس cPanel را در آن وارد نمایید.
 */

return [
    'db' => [
        'host' => getenv('DB_HOST') ?: 'localhost',
        'port' => getenv('DB_PORT') ?: '3306',
        'dbname' => getenv('DB_NAME') ?: 'cpaneluser_hellidb',
        'user' => getenv('DB_USER') ?: 'cpaneluser_dbuser',
        'pass' => getenv('DB_PASS') ?: 'YOUR_STRONG_PASSWORD',
        'charset' => 'utf8mb4'
    ],
    'jwt_secret' => getenv('JWT_SECRET') ?: 'change_this_secret_key_to_something_very_secure_and_long_12345678',
    'woo' => [
        'store_url' => getenv('WOO_STORE_URL') ?: '',
        'consumer_key' => getenv('WOO_CONSUMER_KEY') ?: '',
        'consumer_secret' => getenv('WOO_CONSUMER_SECRET') ?: '',
    ],
    'cors_origin' => '*'
];
