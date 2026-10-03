import React from 'react';
import * as LucideIcons from 'lucide-react';
import { ArrowRight } from 'lucide-react';

export interface StoryFlowStep {
  icon: string;
  label: string;
  sublabel?: string;
}

export interface StoryFlowProps {
  steps: StoryFlowStep[];
}

export function StoryFlow({ steps }: StoryFlowProps) {
  // Safe icon renderer
  const renderIcon = (iconName: string) => {
    // Capitalize and format for lucide (e.g. 'globe' -> 'Globe')
    const formattedName = iconName
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    
    // @ts-ignore
    const IconComponent = LucideIcons[formattedName] || LucideIcons.HelpCircle;
    return <IconComponent size={24} />;
  };

  if (!steps || steps.length === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-8 px-4 bg-slate-50 /50 rounded-2xl border border-slate-100 border-transparent">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex flex-col items-center text-center max-w-[120px]">
            <div className="w-12 h-12 flex items-center justify-center bg-white  text-indigo-600 dark:text-indigo-400 rounded-xl shadow-sm border border-slate-200 border-transparent mb-3">
              {renderIcon(step.icon)}
            </div>
            <div className="font-semibold text-dark  text-sm">{step.label}</div>
            {step.sublabel && (
              <div className="text-xs text-dark dark:text-dark mt-1">{step.sublabel}</div>
            )}
          </div>
          
          {index < steps.length - 1 && (
            <div className="hidden sm:flex text-slate-300 dark:text-dark">
              <ArrowRight size={24} />
            </div>
          )}
          {index < steps.length - 1 && (
            <div className="sm:hidden text-slate-300 dark:text-dark my-2 rotate-90">
              <ArrowRight size={24} />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
