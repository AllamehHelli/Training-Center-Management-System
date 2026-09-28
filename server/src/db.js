// اتصال به MySQL (دیتابیس cPanel) با Connection Pool
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4_unicode_ci',
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// JSON ستون‌ها در mysql2 خودکار parse می‌شوند؛ این فقط برای امانت داده هنگام نوشتن است
export const toJ = (v) => JSON.stringify(v ?? null);
