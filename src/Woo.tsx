/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from './store';
import { toPersianDigits, getTodayJalali, formatToman, validateNationalId, toEnglishDigits } from './utils';
import { ClassRoom, Student, Registration } from './types';
import { useToast, Field, InfoTooltip } from './ui';
import {
  IconWoo,
  IconCheck,
  IconAlert,
  IconEye,
  IconEyeOff,
  IconRefresh,
} from './icons';

/**
 * CR-3: deterministic mock order feed. A real WooCommerce integration fetches
 * paid orders via REST; here we emulate that feed with a FIXED list of sample
 * orders so repeated syncs are idempotent (previously every click fabricated
 * a brand-new student sharing the same national ID).
 */
interface MockWooOrder {
  orderId: number;
  billing: { first_name: string; last_name: string };
  fatherName: string;
  nationalId: string;
  phone: string;
  grade: string;
  gpa: number;
  school: string;
  lineItem: { name: string; price: number };
}

const MOCK_WOO_ORDERS: MockWooOrder[] = [
  {
    orderId: 8841,
    billing: { first_name: 'بردیا', last_name: 'قاسمی‌نژاد' },
    fatherName: 'حمیدرضا',
    nationalId: '0071122338',
    phone: '09121998877',
    grade: 'هفتم',
    gpa: 19.9,
    school: 'مدرسه استعدادهای درخشان',
    lineItem: { name: 'دوره تیزهوشان هفتم', price: 14500000 },
  },
  {
    orderId: 8842,
    billing: { first_name: 'رها', last_name: 'موسوی' },
    fatherName: 'جواد',
    nationalId: '0082233446',
    phone: '09122887766',
    grade: 'هشتم',
    gpa: 18.7,
    school: 'دولصدفی',
    lineItem: { name: 'دوره تقویتی هشتم', price: 12000000 },
  },
  {
    orderId: 8843,
    billing: { first_name: 'ابوالفضل', last_name: 'رستمی' },
    fatherName: 'علی',
    nationalId: 'abc-123', /* deliberately invalid -> review queue, never auto-imported */
    phone: '09123776655',
    grade: 'هفتم',
    gpa: 17.2,
    school: 'تیزهوشان',
    lineItem: { name: 'دوره تیزهوشان هفتم', price: 14500000 },
  },
];

export const Woo: React.FC = () => {
  const {
    state,
    dispatch,
    isViewingArchived,
    getSessionRemainingCapacity,
  } = useAppStore();
  const { showToast } = useToast();

  const [url, setUrl] = useState(state.wooSettings.url || '');
  const [consumerKey, setConsumerKey] = useState(state.wooSettings.consumerKey || '');
  const [consumerSecret, setConsumerSecret] = useState(state.wooSettings.consumerSecret || '');
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({
      type: 'UPDATE_WOO_SETTINGS',
      payload: {
        url: url.trim(),
        consumerKey: consumerKey.trim(),
        consumerSecret: consumerSecret.trim(),
        proxyBaseUrl: proxyBaseUrl.trim(),
      },
    });
    showToast('تنظیمات اتصال ووکامرس ذخیره شد', 'success');
  };

  // HI-5: real connectivity test. Status is derived ONLY from an actual HTTP
  // response (via backend proxy when configured, otherwise direct). Every
  // failure path — wrong keys, non-2xx, network/CORS — records isConnected:false.
  const [proxyBaseUrl, setProxyBaseUrl] = useState(state.wooSettings.proxyBaseUrl || '');

  const buildWooTestUrl = (cleanUrl: string) => {
    const api = cleanUrl + '/wp-json/wc/v3?consumer_key=' + encodeURIComponent(consumerKey) +
      '&consumer_secret=' + encodeURIComponent(consumerSecret);
    const envProxy = ((import.meta as any).env?.VITE_WOO_PROXY_BASE as string | undefined)?.trim() || '';
    const proxy = proxyBaseUrl.trim() || envProxy;
    if (!proxy) return { target: api, viaProxy: false };
    if (/^https?:/i.test(proxy)) {
      return { target: proxy.replace(/\/+$/, '') + '?url=' + encodeURIComponent(api), viaProxy: true };
    }
    return { target: proxy + '?url=' + encodeURIComponent(api), viaProxy: true };
  };

  const logWoo = (message: string, type: 'success' | 'error' | 'info') => {
    dispatch({
      type: 'ADD_WOO_LOG',
      payload: { time: getTodayJalali(), message, type },
    });
  };

  const handleTestConnection = async () => {
    if (!url || !consumerKey || !consumerSecret) {
      showToast('لطفاً آدرس فروشگاه و هر دو کلید API را وارد کنید', 'error');
      return;
    }

    setIsTesting(true);
    const logTime = getTodayJalali();
    const cleanUrl = url.replace(/\/+$/, '');
    const { target, viaProxy } = buildWooTestUrl(cleanUrl);

    let ok = false;
    let failMessage = '';

    try {
      const response = await fetch(target, { method: 'GET' });
      if (response.ok) {
        ok = true;
      } else if (response.status === 401 || response.status === 403) {
        failMessage = 'کلیدهای مصرف‌کننده نامعتبرند یا دسترسی REST در ووکامرس غیرفعال است (HTTP ' + toPersianDigits(String(response.status)) + ').';
      } else {
        failMessage = 'پاسخ ناموفق سرور ووکامرس (HTTP ' + toPersianDigits(String(response.status)) + ').';
      }
    } catch {
      failMessage = viaProxy
        ? 'خطا در تماس با پروکسی بک‌اند؛ از درستی آدرس پروکسی / VITE_WOO_PROXY_BASE و فعال بودن آن اطمینان حاصل کنید.'
        : 'خطای شبکه یا CORS — مرورگر اجازه تماس مستقیم با دامنه فروشگاه را نداد. برای اتصال عملیاتی، پروکسی سمت سرور ضروری است.';
    }

    if (ok) {
      dispatch({
        type: 'UPDATE_WOO_SETTINGS',
        payload: {
          isConnected: true,
          lastSync: logTime + ' - تست موفق (' + (viaProxy ? 'از طریق پروکسی' : 'تماس مستقیم') + ')',
        },
      });
      logWoo('تست اتصال زنده به REST API ووکامرس با موفقیت انجام شد (HTTP 2xx).', 'success');
      showToast('ارتباط واقعی با سرور ووکامرس تأیید شد', 'success');
    } else {
      dispatch({
        type: 'UPDATE_WOO_SETTINGS',
        payload: { isConnected: false, lastSync: logTime + ' - تست ناموفق' },
      });
      logWoo('تست اتصال ووکامرس ناموفق بود: ' + failMessage, 'error');
      showToast(failMessage, 'error');
    }
    setIsTesting(false);
  };

  // Sync Products -> Classes
  const handleSyncProducts = () => {
    setIsSyncingProducts(true);

    setTimeout(() => {
      // Mocked / parsed WooCommerce products
      const wooProducts = [
        {
          id: 501,
          name: 'شیمی و زیست‌شناسی پیشرفته المپیاد',
          price: 13500000,
          grade: 'هشتم',
          teacher: 'تیم مدال‌آوران المپیاد کشوری',
        },
        {
          id: 502,
          name: 'کارگاه جامع تست‌زنی تیزهوشان ششم به هفتم',
          price: 15500000,
          grade: 'ششم',
          teacher: 'دکتر علیرضا میرزایی',
        },
      ];

      const newClasses: ClassRoom[] = [];
      let skippedCount = 0;

      wooProducts.forEach((p) => {
        const exists = state.classes.some(
          (c) => c.name.trim().toLowerCase() === p.name.trim().toLowerCase()
        );
        if (!exists) {
          newClasses.push({
            id: `cls-woo-${p.id}`,
            name: p.name,
            grade: p.grade,
            teacher: p.teacher,
            tuition: p.price,
            sessions: [
              {
                id: `ses-woo-${p.id}-even`,
                kind: 'even',
                label: 'زنگ روزهای زوج (ووکامرس)',
                days: 'شنبه، دوشنبه، چهارشنبه',
                time: '۱۶:۰۰ الی ۱۷:۳۰',
                capacity: 25,
              },
              {
                id: `ses-woo-${p.id}-odd`,
                kind: 'odd',
                label: 'زنگ روزهای فرد (ووکامرس)',
                days: 'یکشنبه، سه‌شنبه، پنجشنبه',
                time: '۱۷:۴۵ الی ۱۹:۱۵',
                capacity: 25,
              },
            ],
          });
        } else {
          skippedCount++;
        }
      });

      if (newClasses.length > 0) {
        dispatch({ type: 'SYNC_WOO_PRODUCTS', payload: newClasses });
        dispatch({
          type: 'ADD_WOO_LOG',
          payload: {
            time: getTodayJalali(),
            message: `همگام‌سازی محصولات انجام شد: ${toPersianDigits(
              newClasses.length
            )} دوره جدید افزوده شد (${toPersianDigits(skippedCount)} مورد تکراری رد شد).`,
            type: 'success',
          },
        });
        showToast(`${toPersianDigits(newClasses.length)} دوره آموزشی از ووکامرس وارد سیستم شد`, 'success');
      } else {
        dispatch({
          type: 'ADD_WOO_LOG',
          payload: {
            time: getTodayJalali(),
            message: 'بررسی محصولات ووکامرس انجام شد؛ تمامی محصولات قبلاً در سامانه ثبت شده‌اند.',
            type: 'info',
          },
        });
        showToast('تمامی دوره‌ها قبلاً همگام شده‌اند', 'info');
      }

      setIsSyncingProducts(false);
    }, 800);
  };

  // Sync Orders -> Registrations & Students
  // CR-3: orders now go through the SAME validation rules as the manual form:
  //   - idempotency on the WooCommerce order number (wooOrderId),
  //   - national-ID format check + uniqueness against existing students,
  //   - valid class/session reference and remaining session capacity,
  //   - no duplicate active registration for the same session.
  // Anything that fails validation is routed to a review queue (log + toast)
  // instead of being silently auto-imported.
  const handleSyncOrders = () => {
    if (isViewingArchived) {
      showToast(
        'مشاهده سال بایگانی فقط-خواندنی است؛ همگامسازی سفارش ممکن نیست.',
        'error'
      );
      return;
    }

    setIsSyncingOrders(true);

    setTimeout(() => {
      const syncedOrderIds = new Set(
        state.registrations.map((r) => r.wooOrderId).filter((v) => v !== undefined).map(String)
      );
      const existingNationalIds = new Set(state.students.map((st) => String(st.nationalId).trim()));

      const newStudents: Student[] = [];
      const newRegistrations: Registration[] = [];
      const reviewQueue: { orderId: number; reason: string }[] = [];

      MOCK_WOO_ORDERS.forEach((order) => {
        const orderIdStr = String(order.orderId);

        // 1) Idempotency: never import the same Woo order twice.
        if (syncedOrderIds.has(orderIdStr)) {
          reviewQueue.push({ orderId: order.orderId, reason: 'سفارش تکراری (قبلاً همگام شده)' });
          return;
        }

        // 2) Field validity: national ID must be a valid Iranian code.
        const nid = toEnglishDigits(String(order.nationalId)).trim();
        const nidCheck = validateNationalId(nid);
        if (!nidCheck.isValid) {
          reviewQueue.push({ orderId: order.orderId, reason: nidCheck.message });
          return;
        }

        // 3) Uniqueness: one student per national ID (same rule as manual form).
        if (existingNationalIds.has(nid)) {
          reviewQueue.push({ orderId: order.orderId, reason: 'کد ملی قبلاً ثبت شده است' });
          return;
        }

        // 4) Resolve target class by grade (fallback: first class), then pick
        //    the first session with remaining capacity (capacity enforcement).
        let targetClass =
          state.classes.find((c) => c.grade === order.grade) || state.classes[0];
        if (!targetClass) {
          reviewQueue.push({ orderId: order.orderId, reason: 'کلاسی برای این پایه واجد نیست' });
          return;
        }
        let targetSessionId = '';
        for (const ses of targetClass.sessions) {
          if (getSessionRemainingCapacity(targetClass.id, ses.id) > 0) {
            targetSessionId = ses.id;
            break;
          }
        }
        if (!targetSessionId) {
          reviewQueue.push({ orderId: order.orderId, reason: 'ظرفیت تمام زنگ‌های این کلاس تکمیل است' });
          return;
        }

        const studentId = `std-woo-${orderIdStr}`;
        const regId = `reg-woo-${orderIdStr}`;
        const trackingCode = `T-WC${orderIdStr}`;
        const amount = order.lineItem.price || targetClass.tuition;

        const student: Student = {
          id: studentId,
          firstName: order.billing.first_name,
          lastName: order.billing.last_name,
          fatherName: order.fatherName,
          nationalId: nid,
          phones: [{ id: `p-${orderIdStr}`, label: 'ولی', number: order.phone }],
          grade: targetClass.grade,
          gpa: order.gpa,
          school: order.school,
          createdAt: getTodayJalali(),
        };

        const registration: Registration = {
          id: regId,
          code: trackingCode,
          studentId,
          classId: targetClass.id,
          sessionId: targetSessionId,
          status: 'pending', // pending operator verification
          amount,
          discount: 0,
          plan: {
            months: 0,
            downPayment: amount,
            installments: [
              {
                id: `inst-woo-${orderIdStr}`,
                title: 'تسویه کامل انترنتی ووکامرس',
                amount,
                dueDate: getTodayJalali(),
                paidAt: null, // left for manual operator check
              },
            ],
          },
          date: getTodayJalali(),
          notes: `سفارش شماره #${orderIdStr} ثبت شده در فروشگاه آنلاین ووکامرس`,
          wooOrderId: order.orderId,
          wooOrderSyncedAt: getTodayJalali(),
        };

        newStudents.push(student);
        newRegistrations.push(registration);
        existingNationalIds.add(nid);
        syncedOrderIds.add(orderIdStr);
      });

      if (newRegistrations.length > 0) {
        dispatch({ type: 'SYNC_WOO_ORDERS', payload: { newStudents, newRegistrations } });
        dispatch({
          type: 'ADD_WOO_LOG',
          payload: {
            time: getTodayJalali(),
            message: `${toPersianDigits(newRegistrations.length)} سفارش ووکامرس با اعتبارسنجی دریافت و به صف بررسی اضافه شد.`,
            type: 'success',
          },
        });
      }

      reviewQueue.forEach((item) => {
        dispatch({
          type: 'ADD_WOO_LOG',
          payload: {
            time: getTodayJalali(),
            message: `سفارش #${toPersianDigits(item.orderId)} به صف بررسی ارجاع شد: ${item.reason}`,
            type: 'info',
          },
        });
      });

      if (newRegistrations.length > 0 && reviewQueue.length > 0) {
        showToast(
          `${toPersianDigits(newRegistrations.length)} سفارش ثبت و ${toPersianDigits(reviewQueue.length)} مورد به صف بررسی ارجاع شد`,
          'info'
        );
      } else if (newRegistrations.length > 0) {
        showToast(
          `${toPersianDigits(newRegistrations.length)} سفارش جدید با اعتبارسنجی به صف بررسی اضافه شد`,
          'success'
        );
      } else if (reviewQueue.length > 0) {
        showToast(
          'سفارش جدیدی قابل ثبت خودکار نبود؛ موارد ناسازگار به صف بررسی ارجاع شدند',
          'info'
        );
      } else {
        showToast('سفارش جدیدی در فروشگاه ووکامرس وارد نشده است', 'info');
      }

      setIsSyncingOrders(false);
    }, 900);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/70">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-900">فروشگاه آنلاین ووکامرس</h2>
            <InfoTooltip
              title="همگام‌سازی با ووکامرس"
              content="اتصال به سایت از طریق WooCommerce REST API جهت دریافت خودکار سفارش‌های ثبت‌نام آنلاین، ساخت پرونده دانش‌آموز و به‌روزرسانی موجودی دوره‌ها."
            />
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            همگام‌سازی سفارش‌های وب‌سایت با ثبت‌نام‌های آموزشگاه
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
              state.wooSettings.isConnected
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                : 'bg-amber-50 text-amber-800 border border-amber-200/70'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                state.wooSettings.isConnected ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
            />
            <span>{state.wooSettings.isConnected ? 'اتصال برقرار است' : 'عدم اتصال'}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: API Settings Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-neutral-200/70 shadow-xs">
            <h3 className="text-lg font-heading font-bold text-neutral-900 mb-4">تنظیمات اتصال به فروشگاه اینترنتی</h3>

            {/* HI-5: honest disclosure about how connectivity works in this build */}
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
              <IconAlert size={16} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">حالت آزمایشی:</span> محصولات و سفارش‌های این صفحه نمونه/ساختگی هستند.
                «آزمایش اعتبار اتصال» تنها در صورتی نتیجه معتبر دارد که یک <strong>پروکسی سمت سرور</strong> پیکربندی شده باشد؛
                انتشار مستقیم کلیدهای Woo در فرانت‌اند امن نیست. آدرس پروکسی را در فیلد زیر یا متغیر محیطی{' '}
                <code dir="ltr" className="font-mono">VITE_WOO_PROXY_BASE</code> وارد کنید.
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <Field label="آدرس اینترنتی وب‌سایت آموزشگاه" required hint="با پیشوند اینترنتی و بدون خط تیره یا اسلش انتهایی">
                <input
                  type="url"
                  dir="ltr"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-shop.example.com"
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-hidden focus:border-neutral-900 font-mono focus:bg-white text-left"
                />
              </Field>

              <Field label="شناسه کاربری ووکامرس (کلید دسترسی)" required hint="شناسه تولید شده در بخش وب‌سرویس ووکامرس">
                <input
                  type="text"
                  dir="ltr"
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  placeholder="ck_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-hidden focus:border-neutral-900 font-mono focus:bg-white text-left"
                />
              </Field>

              <Field label="رمز امنیتی وب‌سایت (کلید اختصاصی)" required hint="رمز امنیتی تولید شده در پنل وردپرس">
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    dir="ltr"
                    value={consumerSecret}
                    onChange={(e) => setConsumerSecret(e.target.value)}
                    placeholder="cs_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="w-full pl-10 pr-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-hidden focus:border-neutral-900 font-mono focus:bg-white text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
                    title={showSecret ? 'پنهان‌سازی' : 'نمایش'}
                  >
                    {showSecret ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </Field>

              {/* HI-5: backend proxy configuration */}
              <Field label="آدرس پروکسی سمت سرور (اختیاری – توصیه‌شده)" hint="مانند https://api.example.com/woo-proxy یا /api/woo-proxy — برای عبور امن از CORS و عدم افشای کلیدها">
                <input
                  type="text"
                  dir="ltr"
                  value={proxyBaseUrl}
                  onChange={(e) => setProxyBaseUrl(e.target.value)}
                  placeholder="/api/woo-proxy"
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-hidden focus:border-neutral-900 font-mono focus:bg-white text-left"
                />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full text-xs font-medium transition-colors"
                >
                  <IconRefresh size={14} className={isTesting ? 'animate-spin' : ''} />
                  <span>{isTesting ? 'در حال آزمایش...' : 'آزمایش اعتبار اتصال'}</span>
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full text-xs font-semibold shadow-xs transition-colors"
                >
                  ذخیره تنظیمات
                </button>
              </div>
            </form>
          </div>

          {/* Sync Actions Panel */}
          <div className="bg-[#FBFDFC] rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-lg font-heading text-[#0A3528]">عملیات همگام‌سازی و انتقال داده</h3>
              <p className="text-xs text-slate-500">
                انتقال محصولات فروشگاه به کلاس‌های آموزشگاه و دریافت سفارش‌های جدید ثبت‌نام
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Sync Products */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#0A3528] mb-1">همگام‌سازی محصولات ← دوره‌ها</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    محصولات فعال در دسته‌بندی دوره‌های تیزهوشان به کلاس آموزشی با دو زنگ زوج و فرد تبدیل می‌شوند.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSyncProducts}
                  disabled={isSyncingProducts}
                  className="mt-4 w-full py-2 bg-white border border-slate-300 hover:border-[#0E7C5B] hover:text-[#0E7C5B] text-slate-700 rounded-lg text-xs font-medium transition-all shadow-xs"
                >
                  {isSyncingProducts ? 'در حال دریافت محصولات...' : 'شروع همگام‌سازی دوره‌ها'}
                </button>
              </div>

              {/* Sync Orders */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#0A3528] mb-1">همگام‌سازی سفارش‌ها ← ثبت‌نام</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    سفارش‌های جدید پرداخت‌شده به پرونده دانش‌آموز و وضعیت ثبت‌نام «در انتظار بررسی» منتقل می‌گردند.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSyncOrders}
                  disabled={isSyncingOrders || isViewingArchived}
                  title={isViewingArchived ? 'همگامسازی در حال مشاهده سال بایگانی ممکن نیست' : undefined}
                  className={`mt-4 w-full py-2 rounded-lg text-xs font-medium transition-all shadow-xs ${
                    isViewingArchived
                      ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                      : 'bg-[#0E7C5B] hover:bg-[#0A3528] text-white'
                  }`}
                >
                  {isSyncingOrders ? 'در حال دریافت سفارش‌ها...' : 'شبیه‌سازی دریافت سفارش آنلاین'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Guide & Activity Log (1 col) */}
        <div className="space-y-6">
          {/* Step-by-Step Setup Guide */}
          <div className="bg-[#FBFDFC] rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-base font-heading text-[#0A3528]">راهنمای گام‌به‌گام اتصال</h3>
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 leading-relaxed">
              <li>وارد پیشخوان وردپرس سایت خود شوید.</li>
              <li>به منوی <strong>ووکامرس ← پیکربندی</strong> بروید.</li>
              <li>تب <strong>پیشرفته</strong> و سپس بخش <strong>کلیدهای ارتباطی وب</strong> را انتخاب نمایید.</li>
              <li>روی دکمه <strong>افزودن کلید</strong> کلیک کنید.</li>
              <li>توضیحات: <span className="font-mono text-emerald-800">سامانه علامه حلی</span> و دسترسی را روی <strong>خواندن و نوشتن</strong> قرار دهید.</li>
              <li>کلیدهای تولید شده را در فرم سمت چپ وارد فرمایید.</li>
            </ol>
          </div>

          {/* Activity Log */}
          <div className="bg-[#FBFDFC] rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-heading text-[#0A3528]">گزارش فعالیت‌های اخیر</h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {toPersianDigits(state.wooSettings.syncLog.length)} رویداد
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {state.wooSettings.syncLog.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">گزارشی ثبت نشده است.</div>
              ) : (
                state.wooSettings.syncLog.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{toPersianDigits(item.time)}</span>
                      {item.type === 'success' && <span className="text-[#0E7C5B]">موفق</span>}
                      {item.type === 'info' && <span className="text-[#3E7CB1]">اطلاع‌رسانی</span>}
                      {item.type === 'error' && <span className="text-[#D64545]">خطا</span>}
                    </div>
                    <div className="text-slate-700 leading-snug">{item.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
