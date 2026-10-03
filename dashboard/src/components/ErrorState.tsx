import { AlertCircle } from 'lucide-react';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "We couldn't load this.", onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-red-50 dark:bg-red-900/10 text-center">
      <AlertCircle className="text-red-500 mb-3" size={32} />
      <p className="text-red-700 dark:text-red-400 font-medium mb-4">{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg font-medium transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
