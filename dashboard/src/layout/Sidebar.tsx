import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Activity, 
  ShieldBan, 
  Monitor, 
  FileText, 
  HeartPulse, 
  Settings, 
  FlaskConical,
  ShieldCheck,
  BookOpen
} from 'lucide-react';

interface SidebarProps {
  expertMode: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ expertMode }) => {
  const navItems = [
    { label: 'Home', icon: Home, to: '/' },
    { label: 'Activity', icon: Activity, to: '/activity' },
    { label: 'Blocked Connections', icon: ShieldBan, to: '/blocked' },
    { label: 'Computer Protection', icon: Monitor, to: '/computer' },
    { label: 'Reports', icon: FileText, to: '/reports' },
    { label: 'System Health', icon: HeartPulse, to: '/health' },
    { label: 'Learn', icon: BookOpen, to: '/learn' },
    { label: 'Settings', icon: Settings, to: '/settings' },
  ];

  if (expertMode) {
    navItems.push({ label: 'Demo Panel', icon: FlaskConical, to: '/demo' });
  }

  return (
    <aside className="hidden sm:flex flex-col w-[80px] lg:w-[260px] h-screen fixed left-0 top-0 bg-[var(--color-background)] transition-all duration-300 z-40">
      <div className="flex items-center justify-center lg:justify-start h-[104px] px-8 pt-4">
        <ShieldCheck className="w-8 h-8 text-[#1A1A1A] shrink-0" strokeWidth={2.5} />
        <span className="ml-3 font-serif italic text-2xl text-[#1A1A1A] hidden lg:block tracking-wide">SentinelAI</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-[#EAE8D9] text-[#1A1A1A] font-semibold'
                  : 'text-[#1A1A1A]/70 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A] font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon 
                  className={`w-[22px] h-[22px] shrink-0 transition-colors ${isActive ? 'text-[#1A1A1A]' : 'text-[#1A1A1A]/60 group-hover:text-[#1A1A1A]'}`} 
                  strokeWidth={2}
                />
                <span className="ml-4 text-[15px] hidden lg:block tracking-tight">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};