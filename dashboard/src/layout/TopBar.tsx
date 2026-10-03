import React from 'react';
import { Bell, ShieldCheck, Zap } from 'lucide-react';

interface TopBarProps {
  expertMode: boolean;
  setExpertMode: (v: boolean) => void;
  liveState: any; // Placeholder for real state type
  unreadCount: number;
  notifications: any[];
  onMarkAllRead: () => void;
}

const ConnectionPill = () => (
  <div className="text-xs bg-[#1A1A1A]/5 text-[#1A1A1A] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
    Live
  </div>
);

const NotificationBell = ({ count }: { count: number }) => (
  <button className="relative p-2 text-[#1A1A1A] hover:bg-[#1A1A1A]/5 rounded-full transition-colors flex items-center justify-center">
    <Bell className="w-6 h-6 stroke-[2.5px]" />
    {count > 0 && (
      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--color-sage)]"></span>
    )}
  </button>
);

export const TopBar: React.FC<TopBarProps> = ({
  expertMode,
  setExpertMode,
  liveState,
  unreadCount,
}) => {
  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 sticky top-0 z-30">
      <header className="h-[72px] bg-[var(--color-sage)] rounded-[2rem] flex items-center justify-between px-4 sm:px-6 shadow-sm border border-[#1A1A1A]/5">
        
        {/* Left Side: Brand (Mobile) + Pills */}
        <div className="flex items-center gap-4">
          <div className="flex items-center sm:hidden mr-2">
            <ShieldCheck className="w-7 h-7 text-[#1A1A1A] stroke-[2.5px]" />
          </div>

          <div className="hidden sm:flex items-center bg-[#1A1A1A]/5 p-1 rounded-full">
            <div className="px-4 py-1 rounded-full text-sm font-bold text-[#1A1A1A] bg-white shadow-sm">
              Protected
            </div>
            <div className="px-4 py-1 rounded-full text-sm font-bold text-[#1A1A1A]/60">
              SentinelAI
            </div>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center space-x-4 sm:space-x-6">
          
          <div className="hidden md:block">
            <ConnectionPill />
          </div>

          {/* Nav Links (Fake) */}
          <div className="hidden lg:flex items-center space-x-6 mr-2 font-bold text-[#1A1A1A]">
            <span className="cursor-pointer hover:opacity-70">Logs</span>
            <span className="cursor-pointer hover:opacity-70">Rules</span>
            <span className="cursor-pointer hover:opacity-70">Lab</span>
          </div>

          {/* Notification */}
          <NotificationBell count={unreadCount} />
          
          {/* Expert Toggle Styled like the 'Get started' button */}
          <button 
            onClick={() => setExpertMode(!expertMode)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-[2px] border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] transition-all hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#1A1A1A] active:translate-y-[3px] active:shadow-none font-bold text-[#1A1A1A] text-sm ${expertMode ? 'bg-[#EEDDFF]' : 'bg-white'}`}
          >
            <Zap className="w-4 h-4 stroke-[2.5px]" />
            {expertMode ? 'Expert Mode On' : 'Enable Expert'}
          </button>
        </div>
      </header>
    </div>
  );
};