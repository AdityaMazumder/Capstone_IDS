import React from 'react';
import { InfoTooltip } from './InfoTooltip';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KpiCardProps {
  icon: React.ReactNode;
  value: string | number;
  title: string;
  helperText: string;
  trend?: 'up' | 'down' | 'flat';
}

export function KpiCard({ icon, value, title, helperText, trend }: KpiCardProps) {
  return (
    <div className="bg-[var(--color-sage)] rounded-[2rem] p-6 flex flex-col relative overflow-hidden transition-transform hover:scale-[1.02] duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 text-dark rounded-xl icon-wrapper">
          {icon}
        </div>
        <InfoTooltip text={helperText} />
      </div>
      
      <div className="flex flex-col mt-auto">
        <div className="text-4xl font-serif text-dark mb-1">{value}</div>
        <div className="text-sm text-dark font-medium uppercase tracking-wider">{title}</div>
        
        {trend && (
          <div className={`flex items-center text-sm font-medium mt-3 ${
            trend === 'up' ? 'text-forest' : trend === 'down' ? 'text-critical' : 'text-dark'
          }`}>
            {trend === 'up' && <TrendingUp size={16} className="mr-1" />}
            {trend === 'down' && <TrendingDown size={16} className="mr-1" />}
            {trend === 'flat' && <Minus size={16} className="mr-1" />}
          </div>
        )}
      </div>
    </div>
  );
}
