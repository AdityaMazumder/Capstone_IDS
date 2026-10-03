import { Bell } from 'lucide-react';
import { useLiveStream } from '../hooks/useLiveStream';
import clsx from 'clsx';

export default function TopBar() {
  const status = useLiveStream();
  
  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center space-x-4">
        <span className="md:hidden font-bold text-lg text-indigo-600">SentinelAI</span>
        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700">
          <div className={clsx(
            'w-2.5 h-2.5 rounded-full',
            status === 'Live' ? 'bg-emerald-500 animate-pulse' :
            status === 'Reconnecting...' ? 'bg-amber-400' : 'bg-slate-400'
          )} />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{status}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <span className="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700 rounded uppercase tracking-wider">
          Test Mode
        </span>
        <button className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600">
          Expert View
        </button>
        <button className="relative p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
