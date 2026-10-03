import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border-2 border-dashed border-slate-200 border-transparent bg-slate-50/50 /20">
      {icon && (
        <div className="text-dark dark:text-dark mb-4 [&>svg]:w-16 [&>svg]:h-16">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-slate-900  mb-2">{title}</h3>
      {description && (
        <p className="text-dark dark:text-dark max-w-md mx-auto mb-6">
          {description}
        </p>
      )}
      {action && (
        <button 
          onClick={action.onClick}
          className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
