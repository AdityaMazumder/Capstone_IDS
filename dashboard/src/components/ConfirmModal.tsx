import React from 'react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = 'Confirm', 
  cancelLabel = 'Cancel', 
  variant = 'default' 
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-[var(--color-sage)] rounded-[2rem] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <h3 className="text-xl font-bold text-slate-900  mb-2">{title}</h3>
          <p className="text-dark dark:text-dark">{message}</p>
        </div>
        <div className="px-6 py-4 bg-slate-50 /50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              variant === 'danger' 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                : 'text-dark hover:bg-slate-200  dark:hover:bg-slate-700'
            }`}
          >
            {cancelLabel}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              variant === 'danger'
                ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
