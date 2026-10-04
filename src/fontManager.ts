/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SystemFontOption {
  id: string;
  name: string;
  family: string;
  description: string;
  isLocalOnly?: boolean;
}

export const PRESET_FONTS: SystemFontOption[] = [
  {
    id: 'app-auto',
    name: 'تشخیص خودکار محلی (Local / GitHub)',
    family: "'AppFont', 'IRANSansX', 'IRANSans', 'Yekan Bakh', 'Dana', 'Peyda', 'Shabnam', system-ui, sans-serif",
    description: 'بارگذاری خودکار از پوشه public/fonts یا فونت‌های فارسی نصب‌شده در ویندوز/مک کاربر',
  },
  {
    id: 'iransansx',
    name: 'ایران‌سنس ایکس (IRANSansX)',
    family: "'IRANSansX', 'IRANSans', 'AppFont', system-ui, sans-serif",
    description: 'فونت مدرن و استاندارد رسمی سازمان‌ها و سامانه‌های اداری',
  },
  {
    id: 'iransans',
    name: 'ایران‌سنس کلاسیک (IRANSans)',
    family: "'IRANSans', 'IRANSansWeb', 'AppFont', system-ui, sans-serif",
    description: 'خوانایی بسیار بالا برای متن‌های بلند و جداول مالی',
  },
  {
    id: 'yekanbakh',
    name: 'یکان‌بخ (Yekan Bakh)',
    family: "'Yekan Bakh', 'YekanBakh', 'Yekan', 'AppFont', system-ui, sans-serif",
    description: 'فونت مدرن هندسی ویژه سامانه‌های پیشرفته و داشبوردها',
  },
  {
    id: 'dana',
    name: 'دانا (Dana)',
    family: "'Dana', 'Dana-Regular', 'AppFont', system-ui, sans-serif",
    description: 'فونت شیک، تمیز و استاندارد نرم‌افزارهای تحت وب',
  },
  {
    id: 'peyda',
    name: 'پیدا (Peyda)',
    family: "'Peyda', 'Peyda-Regular', 'AppFont', system-ui, sans-serif",
    description: 'تایپوگرافی معاصر و جذاب با خوانایی عالی ارقام',
  },
  {
    id: 'shabnam',
    name: 'شبنم (Shabnam)',
    family: "'Shabnam', 'Shabnam-Regular', 'AppFont', system-ui, sans-serif",
    description: 'فونت محبوب متن‌باز بر پایه ارقام و کاراکترهای شفاف',
  },
  {
    id: 'vazirmatn',
    name: 'وزیرمتن (Vazirmatn)',
    family: "'Vazirmatn', 'Vazir', 'AppFont', system-ui, sans-serif",
    description: 'فونت رسمی متن‌باز فارسی سازگار با تمامی مرورگرها',
  },
  {
    id: 'system',
    name: 'پیش‌فرض سیستم‌عامل (System UI)',
    family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    description: 'استفاده مستقیم از فونت فارسی پیش‌فرض دستگاه کاربر',
  },
];

const FONT_STORAGE_KEY = 'helli_selected_font_id';
const CUSTOM_FONT_NAME = 'CustomUserUploadedFont';

/**
 * اعمال فونت فعال بر روی کل سند HTML
 */
export function applyActiveFont(fontId?: string) {
  try {
    const selectedId = fontId || localStorage.getItem(FONT_STORAGE_KEY) || 'app-auto';
    const found = PRESET_FONTS.find((f) => f.id === selectedId) || PRESET_FONTS[0];

    // اگر فونت اختصاصی آپلود شده در حافظه ذخیره شده بود
    const customFontData = localStorage.getItem('helli_custom_font_data');
    if (customFontData && selectedId === 'custom-upload') {
      document.documentElement.style.setProperty(
        '--active-font-family',
        `'${CUSTOM_FONT_NAME}', ${found.family}`
      );
      return;
    }

    document.documentElement.style.setProperty('--active-font-family', found.family);
  } catch (e) {
    console.error('Error applying active font:', e);
  }
}

/**
 * ذخیره و فعال‌سازی یک فونت
 */
export function setActiveFont(fontId: string) {
  try {
    localStorage.setItem(FONT_STORAGE_KEY, fontId);
    applyActiveFont(fontId);
  } catch (e) {
    console.error('Failed to set active font:', e);
  }
}

/**
 * دریافت آی‌دی فونت فعال
 */
export function getActiveFontId(): string {
  try {
    return localStorage.getItem(FONT_STORAGE_KEY) || 'app-auto';
  } catch {
    return 'app-auto';
  }
}

/**
 * بارگذاری مستقیم فایل TTF / WOFF2 در حافظه مرورگر با FontFace API
 */
export async function uploadAndApplyFont(file: File): Promise<{ success: boolean; message: string }> {
  try {
    if (!file.name.match(/\.(ttf|woff|woff2|otf)$/i)) {
      return { success: false, message: 'فرمت فایل معتبر نیست. لطفاً یک فایل با پسوند .ttf یا .woff2 انتخاب کنید.' };
    }

    const buffer = await file.arrayBuffer();
    const fontFace = new FontFace(CUSTOM_FONT_NAME, buffer);
    const loadedFont = await fontFace.load();
    document.fonts.add(loadedFont);

    // تبدیل به Base64 برای ماندگاری در نشست
    if (buffer.byteLength < 4 * 1024 * 1024) { // فقط در صورتی که زیر ۴ مگابایت باشد در localStorage ذخیره شود
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      localStorage.setItem('helli_custom_font_data', base64);
      localStorage.setItem('helli_custom_font_filename', file.name);
    }

    localStorage.setItem(FONT_STORAGE_KEY, 'custom-upload');
    document.documentElement.style.setProperty(
      '--active-font-family',
      `'${CUSTOM_FONT_NAME}', 'AppFont', system-ui, sans-serif`
    );

    return {
      success: true,
      message: `فونت «${file.name}» با موفقیت بارگذاری شد و در کل سامانه اعمال گردید.`,
    };
  } catch (err: any) {
    console.error('Font upload error:', err);
    return { success: false, message: 'خطا در بارگذاری فونت: ' + (err?.message || 'فایل آسیب‌دیده است') };
  }
}

/**
 * بازیابی فونت آپلود شده اختصاصی در هنگام رفرش صفحه
 */
export async function restoreUploadedFontIfAny() {
  try {
    const base64 = localStorage.getItem('helli_custom_font_data');
    if (!base64) return;

    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fontFace = new FontFace(CUSTOM_FONT_NAME, bytes.buffer);
    const loaded = await fontFace.load();
    document.fonts.add(loaded);

    if (localStorage.getItem(FONT_STORAGE_KEY) === 'custom-upload') {
      document.documentElement.style.setProperty(
        '--active-font-family',
        `'${CUSTOM_FONT_NAME}', 'AppFont', system-ui, sans-serif`
      );
    }
  } catch (err) {
    console.warn('Could not restore custom uploaded font:', err);
  }
}
