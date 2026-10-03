import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import { ConnectionPill } from '../components/ConnectionPill';
import { NotificationBell } from '../components/NotificationBell';
import { useOverallStatus } from '../hooks/useOverallStatus';
import type { ConnectionState, LiveNotification } from '../hooks/useLiveStream';

interface TopBarProps {
  expertMode: boolean;
  setExpertMode: (v: boolean) => void;
  liveState: ConnectionState;
  unreadCount: number;
  notifications: LiveNotification[];
  onMarkAllRead: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  protected: 'Protected',
  handled: 'Protected',
  action_needed: 'Needs attention',
  offline: 'Offline',
};

export const TopBar: React.FC<TopBarProps> = ({
  expertMode,
  setExpertMode,
  liveState,
  unreadCount,
  notifications,
  onMarkAllRead,
}) => {
  const { status } = useOverallStatus();

  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 sticky top-0 z-30">
      <header className="h-[72px] bg-[var(--color-sage)] rounded-[2rem] flex items-center justify-between px-4 sm:px-6 shadow-sm border border-[#1A1A1A]/5">
        
        {/* Left Side: Brand (Mobile) + Pills */}
        <div className="flex items-center gap-4">
          <div className="flex items-center sm:hidden mr-2">
            <ShieldCheck className="w-7 h-7 text-[#1A1A1A] stroke-[2.5px]" />
          </div>

          <div className="hidden sm:flex items-center bg-[#1A1A1A]/5 p-1 rounded-full">
            <div className={`px-4 py-1 rounded-full text-sm font-bold shadow-sm ${status === 'action_needed' ? 'bg-orange-500 text-white' : 'bg-white text-[#1A1A1A]'}`}>
              {STATUS_LABELS[status] ?? 'Protected'}
            </div>
            <div className="px-4 py-1 rounded-full text-sm font-bold text-[#1A1A1A]/60">
              SentinelAI
            </div>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center space-x-4 sm:space-x-6">
          
          <div className="hidden md:block">
            <ConnectionPill state={liveState} />
          </div>

          <NotificationBell
            unreadCount={unreadCount}
            notifications={notifications}
            onMarkAllRead={onMarkAllRead}
          />
          
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
