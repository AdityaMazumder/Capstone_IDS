import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldAlert, WifiOff } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export interface StatusBannerProps {
  status: 'protected' | 'handled' | 'action_needed' | 'offline';
  message: string;
  threatCount?: number;
  onShowMe?: () => void;
  onRetry?: () => void;
}

export function StatusBanner({ status, message, onShowMe, onRetry }: StatusBannerProps) {
  const [lastChecked, setLastChecked] = useState(dayjs());

  useEffect(() => {
    const timer = setInterval(() => setLastChecked(dayjs()), 60000);
    return () => clearInterval(timer);
  }, []);

  const config = {
    protected: { bg: 'bg-forest', icon: Shield, color: 'text-sage' },
    handled: { bg: 'bg-medium', icon: ShieldCheck, color: 'text-dark' },
    action_needed: { bg: 'bg-high', icon: ShieldAlert, color: 'text-white' },
    offline: { bg: 'bg-[#2A2A28]', icon: WifiOff, color: 'text-sage' },
  };

  const { bg, icon: Icon, color } = config[status];

  return (
    <div className={`w-full flex flex-col justify-center items-center h-48 rounded-[2rem] border border-dark shadow-[4px_4px_0px_#1A1A1A] ${bg} ${color} transition-colors duration-300 relative overflow-hidden`}>
      <Icon size={64} className={`mb-3 ${status === 'protected' ? 'text-brand' : ''} ${status === 'handled' ? 'text-white' : ''}`} />
      <h2 className="text-3xl font-serif">{message}</h2>
      <p className="text-sm opacity-80 mt-2 font-medium tracking-wide uppercase">Last checked: {lastChecked.fromNow()}</p>
      {status === 'action_needed' && onShowMe && (
        <button onClick={onShowMe} className="mt-4 px-6 py-3 bg-dark text-white border border-white rounded-xl hover:bg-white hover:text-dark transition shadow-[2px_2px_0px_white]">
          Show me
        </button>
      )}
      {status === 'offline' && onRetry && (
        <button onClick={onRetry} className="mt-4 px-6 py-3 bg-white text-dark rounded-xl hover:bg-sage font-bold transition shadow-[2px_2px_0px_#1A1A1A]">
          Retry
        </button>
      )}
    </div>
  );
}
