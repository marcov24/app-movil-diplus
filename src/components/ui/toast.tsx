import { useEffect, useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastItem = ({ toast, onClose }: ToastProps) => {
  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertCircle,
    info: Info
  };

  const colors = {
    success: 'bg-green-50 dark:bg-green-950/30 border-green-500 text-green-800 dark:text-green-200',
    error: 'bg-red-50 dark:bg-red-950/30 border-red-500 text-red-800 dark:text-red-200',
    warning: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-500 text-yellow-800 dark:text-yellow-200',
    info: 'bg-blue-50 dark:bg-blue-950/30 border-blue-500 text-blue-800 dark:text-blue-200'
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-lg border-2 shadow-lg min-w-[300px] max-w-[500px] transition-all duration-300 ease-in-out',
        colors[toast.type]
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer = ({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );
};

// Toast hook
let toastIdCounter = 0;
const toasts: Toast[] = [];
const listeners: Array<(toasts: Toast[]) => void> = [];

const notify = (message: string, type: ToastType = 'info', duration?: number) => {
  const id = `toast-${++toastIdCounter}`;
  const newToast: Toast = { id, message, type, duration };
  toasts.push(newToast);
  listeners.forEach(listener => listener([...toasts]));
  
  return id;
};

const remove = (id: string) => {
  const index = toasts.findIndex(t => t.id === id);
  if (index > -1) {
    toasts.splice(index, 1);
    listeners.forEach(listener => listener([...toasts]));
  }
};

export const useToast = () => {
  const [toastList, setToastList] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setToastList(newToasts);
    };
    listeners.push(listener);
    setToastList([...toasts]);

    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    toasts: toastList,
    toast: (message: string, type?: ToastType, duration?: number) => notify(message, type, duration),
    success: (message: string, duration?: number) => notify(message, 'success', duration),
    error: (message: string, duration?: number) => notify(message, 'error', duration),
    warning: (message: string, duration?: number) => notify(message, 'warning', duration),
    info: (message: string, duration?: number) => notify(message, 'info', duration),
    remove
  };
};
