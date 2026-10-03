import { NavLink } from 'react-router-dom';
import { Home, Activity, ShieldBan, Shield } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/activity', icon: Activity, label: 'Activity' },
  { to: '/blocked', icon: ShieldBan, label: 'Blocked Connections' },
  { to: '/computer', icon: Shield, label: 'Computer Protection' },
  // { to: '/reports', icon: FileText, label: 'Reports' },
  // { to: '/health', icon: ActivitySquare, label: 'System Health' },
  // { to: '/learn', icon: BookOpen, label: 'Learn' },
  // { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-800 text-slate-300 hidden md:flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-slate-700">
        <Shield className="w-8 h-8 text-indigo-500 mr-3" />
        <span className="text-xl font-bold text-white">SentinelAI</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center px-3 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-slate-700 hover:text-white'
                  )
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
