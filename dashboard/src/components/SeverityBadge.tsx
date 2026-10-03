import React from 'react';
import { AlertCircle, AlertTriangle, Info, Shield } from 'lucide-react';
import { translateSeverity } from '../lib/translate';

export interface SeverityBadgeProps {
  severity: string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const { label, color, icon: iconName } = translateSeverity(severity);

  const icons: Record<string, React.ReactNode> = {
    'alert-circle': <AlertCircle size={16} />,
    'alert-triangle': <AlertTriangle size={16} />,
    'info': <Info size={16} />,
    'shield': <Shield size={16} />
  };

  const Icon = icons[iconName] || <AlertCircle size={16} />;

  const colorStyles: Record<string, string> = {
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    slate: 'bg-slate-100 text-dark /30 dark:text-dark'
  };

  const badgeColor = colorStyles[color] || colorStyles.slate;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase ${badgeColor}`}>
      {Icon}
      {label}
    </span>
  );
}
