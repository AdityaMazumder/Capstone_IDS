import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  House, 
  Activity, 
  ShieldBan, 
  Monitor, 
  Menu,
  X,
  FileText, 
  HeartPulse, 
  BookOpen, 
  Settings, 
  FlaskConical
} from 'lucide-react';

interface MobileNavProps {
  expertMode: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({ expertMode }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const mainItems = [
    { label: 'Home', icon: House, to: '/' },
    { label: 'Activity', icon: Activity, to: '/activity' },
    { label: 'Blocked', icon: ShieldBan, to: '/blocked' },
    { label: 'Computer', icon: Monitor, to: '/computer' },
  ];

  const moreItems = [
    { label: 'Reports', icon: FileText, to: '/reports' },
    { label: 'Health', icon: HeartPulse, to: '/health' },
    { label: 'Learn', icon: BookOpen, to: '/learn' },
    { label: 'Settings', icon: Settings, to: '/settings' },
  ];

  if (expertMode) {
    moreItems.push({ label: 'Demo', icon: FlaskConical, to: '/demo' });
  }

  return (
    <>
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-50">
        <div className="flex justify-around items-center h-16">
          {mainItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              isMenuOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="sm:hidden fixed bottom-16 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-lg z-40 max-h-[50vh] overflow-y-auto pb-safe">
          <div className="py-2 px-4 space-y-1">
            {moreItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-lg ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-300'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
