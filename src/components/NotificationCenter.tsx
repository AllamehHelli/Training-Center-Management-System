import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Megaphone,
  Sparkles,
  Users,
  Copy,
} from 'lucide-react';
import { useAppStore } from '../store';
import { toPersianDigits, formatToman, getTodayJalali } from '../utils';
import { ViewMode } from '../App';

export type NotificationCategory = 'all' | 'pending' | 'announcements';

export interface QuickAnnouncement {
  id: string;
  title: string;
  content: string;
  category: 'announcement' | 'urgent';
  createdAt: string;
  author: string;
}

export interface AppNotification {
  id: string;
  type: 'registration_pending' | 'announcement';
  category: 'pending' | 'announcements';
  title: string;
  description: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetView: ViewMode;
  targetFilter?: any;
  extraInfo?: string;
  actionLabel?: string;
  announcementObj?: QuickAnnouncement;
  isRead: boolean;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewMode, filters?: any) => void;
  unreadCountChange?: (count: number) => void;
}

const STORAGE_READ_NOTIFS_KEY = 'helli_read_notifications_v2';
const STORAGE_ANNOUNCEMENTS_KEY = 'helli_quick_announcements_v2';

const DEFAULT_ANNOUNCEMENTS: QuickAnnouncement[] = [
  {
    id: 'ann-1',
    title: 'جلسه هماهنگی ثبت‌نام سال تحصیلی جدید',
    content: 'جلسه بررسی ظرفیت کلاس‌ها و برنامه‌ریزی زنگ‌های آموزشی روز چهارشنبه ساعت ۱۴ در سالن جلسات برگزار می‌شود.',
    category: 'announcement',
    createdAt: 'امروز ۱۰:۳۰',
    author: 'معاونت آموزشی',
  },
  {
    id: 'ann-2',
    title: 'اطلاعیه مهم: تایید نهایی پذیرفته‌شدگان آزمون ورودی',
    content: 'همکاران محترم دبیرخانه، بررسی مدارک و وضعیت پذیرش داوطلبان جدید الورود تا پایان ساعت اداری نیازمند ثبت در سامانه است.',
    category: 'urgent',
    createdAt: 'امروز ۰۸:۴۵',
    author: 'مدیریت موسسه',
  },
];

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onNavigate,
  unreadCountChange,
}) => {
  const { state } = useAppStore();
  const [activeTab, setActiveTab] = useState<NotificationCategory>('all');
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_READ_NOTIFS_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const [announcements, setAnnouncements] = useState<QuickAnnouncement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ANNOUNCEMENTS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_ANNOUNCEMENTS;
    } catch {
      return DEFAULT_ANNOUNCEMENTS;
    }
  });

  const [isAddingAnnouncement, setIsAddingAnnouncement] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnCategory, setNewAnnCategory] = useState<'announcement' | 'urgent'>('urgent');
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  // Persist read notifications
  const saveReadNotifs = (newSet: Set<string>) => {
    setReadNotifIds(newSet);
    try {
      localStorage.setItem(STORAGE_READ_NOTIFS_KEY, JSON.stringify(Array.from(newSet)));
    } catch {
      // storage unavailable
    }
  };

  // Persist announcements
  const saveAnnouncements = (list: QuickAnnouncement[]) => {
    setAnnouncements(list);
    try {
      localStorage.setItem(STORAGE_ANNOUNCEMENTS_KEY, JSON.stringify(list));
    } catch {
      // storage unavailable
    }
  };

  // Compile notifications (Only New Registrations + Announcements)
  const notifications: AppNotification[] = useMemo(() => {
    const list: AppNotification[] = [];
    const today = getTodayJalali();
    const studentsMap = new Map(state.students.map((s) => [s.id, s]));
    const classesMap = new Map(state.classes.map((c) => [c.id, c]));

    // 1. Pending Registrations
    const pendingRegs = state.registrations.filter((r) => r.status === 'pending');
    pendingRegs.forEach((reg) => {
      const std = studentsMap.get(reg.studentId);
      const cls = classesMap.get(reg.classId);
      const stdName = std ? `${std.firstName} ${std.lastName}` : 'دانش‌آموز';
      const clsName = cls ? cls.name : 'دوره آموزشی';
      const notifId = `reg-pending-${reg.id}`;

      list.push({
        id: notifId,
        type: 'registration_pending',
        category: 'pending',
        title: `ثبت‌نام جدید: ${stdName}`,
        description: `کلاس ${clsName} • کد پیگیری: ${toPersianDigits(reg.code || '')}`,
        timestamp: reg.date || today,
        priority: 'high',
        targetView: 'registrations',
        targetFilter: { status: 'pending', q: reg.code, openDossierRegId: reg.id },
        extraInfo: `شهریه: ${formatToman(reg.amount)}`,
        actionLabel: 'مشاهده و تأیید ثبت‌نام',
        isRead: readNotifIds.has(notifId),
      });
    });

    // 2. Urgent & School Announcements
    announcements.forEach((ann) => {
      const annNotifId = `ann-post-${ann.id}`;
      list.push({
        id: annNotifId,
        type: 'announcement',
        category: 'announcements',
        title: ann.title,
        description: ann.content,
        timestamp: ann.createdAt,
        priority: ann.category === 'urgent' ? 'urgent' : 'medium',
        targetView: 'dashboard',
        extraInfo: ann.author,
        actionLabel: 'مشاهده متن پیام',
        announcementObj: ann,
        isRead: readNotifIds.has(annNotifId),
      });
    });

    // Sort: Unread first, then by priority (urgent > high > medium > low)
    const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
    return list.sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    });
  }, [state.registrations, state.students, state.classes, readNotifIds, announcements]);

  // Total unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Sync unread count to parent if provided
  useEffect(() => {
    unreadCountChange?.(unreadCount);
  }, [unreadCount, unreadCountChange]);

  // Filtered by active tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    if (activeTab === 'pending') {
      return notifications.filter((n) => n.category === 'pending');
    }
    return notifications.filter((n) => n.category === 'announcements');
  }, [notifications, activeTab]);

  // Mark all as read
  const handleMarkAllRead = () => {
    const allIds = new Set(readNotifIds);
    notifications.forEach((n) => allIds.add(n.id));
    saveReadNotifs(allIds);
  };

  // Click on a notification item
  const handleNotificationClick = (notif: AppNotification) => {
    const nextSet = new Set(readNotifIds);
    nextSet.add(notif.id);
    saveReadNotifs(nextSet);

    if (notif.type === 'announcement' && notif.announcementObj) {
      // Inline toggle expansion: smooth, never locks UI
      setExpandedAnnouncementId((prev) => (prev === notif.announcementObj!.id ? null : notif.announcementObj!.id));
      return;
    }

    onClose();
    onNavigate(notif.targetView, notif.targetFilter);
  };

  // Add new quick announcement
  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) return;

    const newAnn: QuickAnnouncement = {
      id: `ann-${Date.now()}`,
      title: newAnnTitle.trim(),
      content: newAnnContent.trim(),
      category: newAnnCategory,
      createdAt: `امروز ${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`,
      author: 'مدیر سامانه',
    };

    const updated = [newAnn, ...announcements];
    saveAnnouncements(updated);
    setNewAnnTitle('');
    setNewAnnContent('');
    setIsAddingAnnouncement(false);
    setExpandedAnnouncementId(newAnn.id);
  };

  // Delete announcement
  const handleDeleteAnnouncement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = announcements.filter((a) => a.id !== id);
    saveAnnouncements(updated);
    if (expandedAnnouncementId === id) {
      setExpandedAnnouncementId(null);
    }
  };

  // Copy announcement content
  const handleCopyText = (content: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      {/* Dimmed backdrop / click outside */}
      <div
        className="fixed inset-0 bg-neutral-900/25 backdrop-blur-2xs transition-opacity duration-200 pointer-events-auto"
        onClick={onClose}
      />

      {/* Popover Card anchored right below top bar */}
      <div
        ref={containerRef}
        className="fixed left-3 sm:left-6 top-14 sm:top-16 z-50 w-[calc(100vw-24px)] sm:w-[440px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-neutral-200/90 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 pointer-events-auto text-right"
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100/80 text-orange-600 flex items-center justify-center shadow-xs">
              <BellRing size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <span>اطلاعیه‌ها و ثبت‌نام‌های جدید</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EA580C] text-white">
                    {toPersianDigits(unreadCount)} جدید
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-neutral-500">
                اطلاع‌رسانی سریع و بررسی ثبت‌نام‌های ورودی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-xl text-xs transition-colors flex items-center gap-1"
                title="علامت‌گذاری همه به‌عنوان خوانده‌شده"
              >
                <CheckCheck size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAddingAnnouncement(!isAddingAnnouncement)}
              className={`p-1.5 rounded-xl text-xs transition-colors flex items-center gap-1 ${
                isAddingAnnouncement
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/60'
              }`}
              title="ثبت پیام و اطلاعیه فوری"
            >
              <Megaphone size={16} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-xl transition-colors"
              aria-label="بستن پنجره"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Announcement Form Drawer */}
        {isAddingAnnouncement && (
          <form
            onSubmit={handleCreateAnnouncement}
            className="p-4 bg-purple-50/80 border-b border-purple-100 text-xs flex flex-col gap-2.5 animate-in slide-in-from-top duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-900 flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-600" />
                ثبت پیام و اطلاعیه فوری جدید
              </span>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setNewAnnCategory('urgent')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    newAnnCategory === 'urgent'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  فوری
                </button>
                <button
                  type="button"
                  onClick={() => setNewAnnCategory('announcement')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    newAnnCategory === 'announcement'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  عمومی
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="عنوان اطلاعیه (مثلاً: جلسه اضطراری هماهنگی آزمون)"
              value={newAnnTitle}
              onChange={(e) => setNewAnnTitle(e.target.value)}
              className="w-full px-3 py-1.5 bg-white rounded-xl border border-purple-200 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-400 text-xs"
              required
            />

            <textarea
              rows={2}
              placeholder="متن پیام اطلاع‌رسانی سریع برای همکاران..."
              value={newAnnContent}
              onChange={(e) => setNewAnnContent(e.target.value)}
              className="w-full px-3 py-1.5 bg-white rounded-xl border border-purple-200 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none text-xs"
              required
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingAnnouncement(false)}
                className="px-3 py-1 text-neutral-600 hover:bg-neutral-200/50 rounded-lg text-xs"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs transition-colors shadow-2xs"
              >
                انتشار اطلاعیه
              </button>
            </div>
          </form>
        )}

        {/* Categories Tab Bar */}
        <div className="px-4 py-2 bg-white border-b border-neutral-100 flex items-center gap-1.5">
          {[
            { id: 'all', label: 'همه اعلان‌ها', count: notifications.length },
            {
              id: 'pending',
              label: 'ثبت‌نام‌های جدید',
              count: notifications.filter((n) => n.category === 'pending').length,
            },
            {
              id: 'announcements',
              label: 'اطلاعیه‌های فوری',
              count: notifications.filter((n) => n.category === 'announcements').length,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as NotificationCategory)}
                className={`px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-neutral-900 text-white font-medium shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-neutral-700 text-neutral-200' : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {toPersianDigits(tab.count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 p-2 sm:max-h-[480px]">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3">
                <Check size={24} />
              </div>
              <p className="text-sm font-bold text-neutral-800">هیچ اعلان یا ثبت‌نام جدیدی وجود ندارد</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                تمامی ثبت‌نام‌ها بررسی شده و وضعیت سیستم به‌روز است.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isUnread = !notif.isRead;
              const isAnnouncement = notif.type === 'announcement';
              const isExpanded = isAnnouncement && expandedAnnouncementId === notif.announcementObj?.id;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group relative p-3 rounded-2xl transition-all cursor-pointer flex flex-col my-1 ${
                    isUnread
                      ? 'bg-neutral-50/90 hover:bg-neutral-100/90 border border-neutral-200/60 shadow-2xs'
                      : 'hover:bg-neutral-50/80 border border-transparent'
                  } ${isExpanded ? 'ring-1 ring-neutral-300 bg-neutral-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Category Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                        notif.type === 'registration_pending'
                          ? 'bg-orange-100 text-orange-600'
                          : notif.priority === 'urgent'
                          ? 'bg-rose-100 text-rose-600'
                          : 'bg-indigo-100 text-indigo-600'
                      }`}
                    >
                      {notif.type === 'registration_pending' ? <Users size={18} /> : <Megaphone size={18} />}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className={`text-xs truncate ${
                            isUnread ? 'font-bold text-neutral-900' : 'font-medium text-neutral-700'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        <div className="flex items-center gap-1 shrink-0">
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-[#EA580C] ring-2 ring-white" />
                          )}
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {toPersianDigits(notif.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Snippet / collapsed text */}
                      {!isExpanded && (
                        <p className="text-[11px] text-neutral-600 mt-1 line-clamp-2 leading-relaxed">
                          {notif.description}
                        </p>
                      )}

                      {/* Footer Actions / Pill */}
                      {!isExpanded && (
                        <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-neutral-100">
                          {notif.extraInfo ? (
                            <span className="text-[10px] font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md">
                              {notif.extraInfo}
                            </span>
                          ) : (
                            <span />
                          )}

                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-800 bg-white group-hover:bg-neutral-900 group-hover:text-white px-2.5 py-1 rounded-lg border border-neutral-200/90 shadow-2xs transition-all shrink-0">
                            <span>{notif.actionLabel}</span>
                            {isAnnouncement ? (
                              <ChevronDown size={13} />
                            ) : (
                              <ChevronLeft size={13} className="rtl:rotate-0" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Announcement Content Drawer (Accordion) */}
                  {isExpanded && notif.announcementObj && (
                    <div
                      className="mt-3 pt-3 border-t border-neutral-200/80 animate-in fade-in duration-150 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-2xs text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap">
                        {notif.announcementObj.content}
                      </div>

                      <div className="flex items-center justify-between mt-2.5 text-[11px]">
                        <span className="text-neutral-400">
                          نویسنده: <strong className="text-neutral-700">{notif.announcementObj.author}</strong>
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleCopyText(notif.announcementObj!.content, notif.announcementObj!.id, e)}
                            className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <Copy size={12} />
                            <span>{copiedId === notif.announcementObj.id ? 'کپی شد!' : 'کپی متن'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteAnnouncement(notif.announcementObj!.id, e)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg flex items-center gap-1 transition-colors"
                            title="حذف این اطلاعیه"
                          >
                            <Trash2 size={12} />
                            <span>حذف</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedAnnouncementId(null);
                            }}
                            className="px-2.5 py-1 bg-neutral-900 hover:bg-black text-white rounded-lg flex items-center gap-1 transition-colors font-medium"
                          >
                            <ChevronUp size={12} />
                            <span>بستن</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-100 bg-neutral-50/70 flex items-center justify-between text-xs text-neutral-500">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('registrations', { status: 'pending' });
            }}
            className="hover:text-neutral-900 font-semibold transition-colors flex items-center gap-1 text-[11px]"
          >
            <span>مشاهده همه ثبت‌نام‌های در انتظار</span>
            <ChevronLeft size={13} />
          </button>

          <span className="text-[10px] text-neutral-400">
            سامانه تیزهوشان علامه حلی
          </span>
        </div>
      </div>
    </div>
  );
};
