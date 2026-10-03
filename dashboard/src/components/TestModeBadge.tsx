import React, { useState, useEffect } from 'react';
import { X, Beaker } from 'lucide-react';

export function TestModeBadge() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const isDismissed = localStorage.getItem('sentinel_testmode_dismissed') === 'true';
    setDismissed(isDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('sentinel_testmode_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs font-bold uppercase tracking-wider">
        <Beaker size={14} />
        Test Mode
      </span>

      {!dismissed && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-blue-600 text-white p-4 rounded-xl shadow-lg flex items-start gap-3 z-50">
          <Beaker className="shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="font-bold mb-1">Test Mode Active</h4>
            <p className="text-blue-100 text-sm">
              SentinelAI is currently simulating alerts. No actual blocking actions will be performed on your system.
            </p>
          </div>
          <button 
            onClick={handleDismiss}
            className="text-blue-200 hover:text-white p-1 rounded-lg hover:bg-blue-500 transition-colors"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}
