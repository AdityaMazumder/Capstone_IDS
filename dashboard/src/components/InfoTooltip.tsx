import { Info } from 'lucide-react';

export interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <div className="group relative flex items-center justify-center cursor-help">
      <Info size={16} className="text-dark hover:text-dark dark:hover:text-slate-300 transition-colors" />
      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-lg shadow-xl text-center z-10 before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-slate-800 dark:before:border-t-slate-700">
        {text}
      </div>
    </div>
  );
}
