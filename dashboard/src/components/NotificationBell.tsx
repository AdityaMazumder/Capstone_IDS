import { useState, useRef, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { alertLink } from '../hooks/useLiveStream';
import type { LiveNotification } from '../hooks/useLiveStream';

dayjs.extend(relativeTime);

export interface NotificationBellProps {
  unreadCount: number;
  notifications: LiveNotification[];
  onMarkAllRead: () => void;
}

export function NotificationBell({ unreadCount, notifications, onMarkAllRead }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-dark hover:text-dark dark:text-dark dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[var(--color-sage)] rounded-[2rem] border border-slate-200 border-transparent z-50 overflow-hidden">
          <div className="p-4 border-b border-slate-100 border-transparent flex justify-between items-center">
            <h3 className="font-bold text-slate-900 ">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={onMarkAllRead}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
              >
                <Check size={14} />
                Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-dark dark:text-dark">
                <Bell className="mx-auto mb-2 opacity-20" size={32} />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {notifications.slice(0, 20).map((n) => (
                  <Link 
                    key={n.id}
                    to={alertLink(n)}
                    onClick={() => setIsOpen(false)}
                    className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${n.isNew ? 'bg-indigo-500' : 'bg-transparent'}`} />
                      <div>
                        <p className={`text-sm ${n.isNew ? 'font-bold text-slate-900 ' : 'font-medium text-dark '}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-dark dark:text-dark mt-1 line-clamp-2">
                          {n.story}
                        </p>
                        <p className="text-[10px] text-dark mt-2 font-medium uppercase tracking-wider">
                          {dayjs.unix(n.time).fromNow()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
