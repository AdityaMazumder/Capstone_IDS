import React from 'react';

export interface ConnectionPillProps {
  state: 'connected' | 'reconnecting' | 'offline';
}

export function ConnectionPill({ state }: ConnectionPillProps) {
  const config = {
    connected: { label: 'Live', dot: 'bg-emerald-500', container: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
    reconnecting: { label: 'Reconnecting...', dot: 'bg-amber-500 animate-pulse', container: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
    offline: { label: 'Offline', dot: 'bg-slate-400', container: 'bg-slate-50 text-dark  dark:text-dark' }
  };

  const { label, dot, container } = config[state] || config.offline;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${container}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`}></span>
      {label}
    </div>
  );
}
