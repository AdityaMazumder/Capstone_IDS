import React from 'react';
import { Link } from 'react-router-dom';
import { Globe, Monitor, ChevronRight } from 'lucide-react';

export interface AlertCardProps {
  alert: {
    id: string;
    source: string;
    time: string;
    severity: string;
    severityRaw: string;
    riskScore: number;
    typeRaw: string;
    title: string;
    story: string;
    actionLabel: string;
    actionState: string;
    srcIp?: string;
    dstIp?: string;
    processName?: string;
    isNew?: boolean;
  };
}

export function AlertCard({ alert }: AlertCardProps) {
  const borderColors: Record<string, string> = {
    CRITICAL: 'border-l-red-600',
    HIGH: 'border-l-orange-500',
    MEDIUM: 'border-l-amber-400',
    LOW: 'border-l-sky-500',
  };

  const borderColor = borderColors[alert.severity] || 'border-l-slate-400';

  const actionColors: Record<string, string> = {
    Blocked: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Test mode': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    Failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  const actionColor = actionColors[alert.actionState] || 'bg-slate-100 text-dark  dark:text-dark';

  return (
    <Link 
      to={`/activity/${alert.source}/${alert.id}`}
      className={`block bg-[var(--color-sage)] rounded-[2rem] p-6 transition-transform hover:scale-[1.01] duration-300 relative ${alert.isNew ? 'animate-slide-in animate-highlight' : ''}`}
    >
      {alert.isNew && <span className="absolute top-4 right-4 px-3 py-1 bg-brand text-[#111] text-xs font-bold rounded-full uppercase tracking-wider">New</span>}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${borderColor.replace('border-l-', 'bg-')}`}></div>
          <h3 className="font-serif font-bold text-dark text-xl">{alert.title}</h3>
        </div>
        
        <p className="text-dark line-clamp-2 leading-relaxed">{alert.story}</p>
        
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm font-medium">
          <div className="flex items-center gap-1.5 text-dark bg-medium px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_#1A1A1A] border border-dark">
            {alert.source === 'internet' ? <Globe size={16}  /> : <Monitor size={16}  />}
            <span>{alert.source === 'internet' ? 'Internet' : 'This computer'}</span>
          </div>
          <div className={`px-3 py-1.5 rounded-xl shadow-sm border border-transparent ${actionColor}`}>
            {alert.actionState}
          </div>
          <div className="text-dark text-xs ml-auto flex items-center group relative cursor-help pt-1">
            {alert.time}
            <div className="hidden group-hover:block absolute bottom-full right-0 mb-2 px-3 py-2 bg-[#1A1A1A] text-[#FDFBF7] text-xs rounded-xl whitespace-nowrap z-10 shadow-lg">
              {alert.time}
            </div>
            <ChevronRight className="text-dark ml-1" size={16} />
          </div>
        </div>
      </div>
    </Link>
  );
}
