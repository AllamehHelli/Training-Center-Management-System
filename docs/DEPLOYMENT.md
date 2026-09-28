# راهنمای راه‌اندازی نسخه عملیاتی (cPanel + MySQL)

این پروژه حالا دو بخش دارد:
- **فرانت‌اند** (`src/`): همان اپ React/Vite. با `VITE_API_BASE=/api` در حالت «عملیاتی» (لاگین + همگام‌سازی با سرور) و بدون آن در حالت «محلی» (localStorage، فقط دمو) build می‌شود.
- **بک‌اند** (`server/`): Node.js + Express + MySQL — احراز هویت JWT، RBAC، لاگ ممیزی، API ثبت‌نام/مالی/آرشیو و پروکسی امن ووکامرس.

## گام ۱ — دیتابیس در cPanel
1. cPanel → *MySQL Databases*: یک دیتابیس (مثلاً `regdb`) و یک کاربر بسازید و کاربر را به دیتابیس با تمام امتیازها وصل کنید.
2. phpMyAdmin → دیتابیس → تب SQL → کل محتوای `server/sql/schema.sql` را Paste و Go بزنید.

## گام ۲ — ساخت اپ Node.js
1. cPanel → *Setup Node.js App* → Create Application:
   - Node.js version: 20+
   - Application mode: Production
   - Application root: `app/server`  (مسیر مطلق: `/home/USER/app/server`)
   - Application URL: ساب‌دامین `reg.yourdomain.com`
   - Application startup file: `app.cpanel.js`
2. پس از ساخت، فایل `.env` داخل `app/server` بسازید (الگو: `server/.env.example`):
   مقادیر DB، `JWT_SECRET` تصادفی (۹۶ هگز) و در صورت نیاز `WOO_*`.
3. ترمینال هاست (SSH) یا cPanel Terminal:
   ```bash
   source ~/user-nodevenv/bin/activate   # venv که cPanel ساخته
   cd ~/app/server
   npm install --omit=dev
   node src/migrate.js make-admin        # ساخت کاربر admin
   ```
4. برای انتقال داده فعلی مرورگر: در اپ محلی «خروجی پشتیبان» را بگیرید و سپس:
   `node src/migrate.js seed-demo export.json`

## گام ۳ — فرانت‌اند
GitHub Actions (`.github/workflows/deploy.yml`) با هر push روی main:
build با `VITE_API_BASE=/api` → rsync پوشه `dist/` به `~/app/dist` و `server/` به `~/app/server` → `npm install`.
Secrets لازم: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH=/home/USERNAME`.

⚠️ مسیر سرو: چون اپ Node ریشه‌اش `app/server` است، تنظیمات cPanel باید طوری باشد که `DocumentRoot` عملاً `~/app` باشد تا هم `dist/` سرو شود و هم `/api/*` به Node برسد. ساده‌ترین روش: داخل `app/server` symlink بزنید:
```bash
ln -s ../dist ~/app/server/../dist   # server/src/index.js خودش ../../dist را سرو می‌کند
```
(در کد، استاتیک از `../../dist` نسبت به `server/src` سرو می‌شود؛ یعنی `~/app/dist`.) اگر cPanel اجازه نداد، `dist/index.html` و assetها را مستقیم در `public_html/reg` آپلود و در `.env` سرور `CORS_ORIGIN=https://reg.yourdomain.com` بگذارید؛ آنگاه `VITE_API_BASE` را کامل بنویسید: `https://reg.yourdomain.com/api`.

## گام ۴ — بررسی نهایی
- `https://reg.yourdomain.com/api/health` → `{"ok":true}`
- ورود با admin → صفحه برنامه؛ بدون لاژین، داده‌ای نمایش داده نمی‌شود.
- تست اتصال ووکامرس از *صفحه Woo* → فقط وقتی کلیدهای سمت سرور درست باشند «متصل» می‌شود.

## امنیت
- کلیدهای قدیمی `ck_/cs_` موجود در تاریخچه Git را در WooCommerce باطل (Revoke) کنید.
- رمز پیش‌فرض admin را فوراً عوض کنید؛ JWT_SECRET را لو ندهید؛ `.env` هرگز commit نشود.
