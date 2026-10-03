import React from 'react';

export interface RiskGaugeProps {
  score: number; // 0 to 10
}

export function RiskGauge({ score }: RiskGaugeProps) {
  const normalizedScore = Math.min(Math.max(score, 0), 10);
  const percentage = (normalizedScore / 10) * 100;
  
  let color = '#38bdf8'; // sky-400
  let label = 'Low';
  
  if (normalizedScore >= 8) {
    color = '#dc2626'; // red-600
    label = 'Critical';
  } else if (normalizedScore >= 6) {
    color = '#f97316'; // orange-500
    label = 'High';
  } else if (normalizedScore >= 4) {
    color = '#fbbf24'; // amber-400
    label = 'Medium';
  }

  const radius = 40;
  const circumference = Math.PI * radius;
  const dashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-12 overflow-hidden">
        <svg className="w-24 h-24 transform -rotate-180" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="12"
            className="text-slate-200 dark:text-dark"
            strokeDasharray={`${circumference} ${circumference}`}
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 text-center font-bold text-xl text-dark ">
          {normalizedScore.toFixed(1)}
        </div>
      </div>
      <div className="mt-1 text-sm font-medium" style={{ color }}>
        {label} Risk
      </div>
    </div>
  );
}
