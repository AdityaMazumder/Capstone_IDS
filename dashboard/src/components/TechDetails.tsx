import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

export interface TechDetailsProps {
  data: Record<string, any>;
  defaultOpen?: boolean;
}

export function TechDetails({ data, defaultOpen = false }: TechDetailsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-50  rounded-xl overflow-hidden border border-slate-200 border-transparent">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-100  hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-2 font-semibold text-dark ">
          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          Technical details
        </div>
        <div 
          onClick={handleCopy}
          className="p-1.5 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md text-dark hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Copy as JSON"
        >
          {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 overflow-x-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="text-xs font-semibold text-dark dark:text-dark uppercase tracking-wider mb-1">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="text-sm font-mono text-dark  break-all bg-white dark:bg-slate-950 p-2 rounded-md border border-slate-200 border-transparent">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
