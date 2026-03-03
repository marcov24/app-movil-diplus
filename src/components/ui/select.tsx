/**
 * Select components — Ionic-compatible, Tailwind-styled
 * Replaces Radix Select with native HTML select
 */
import React from 'react';
import { cn } from '@/lib/utils';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  defaultValue?: string;
}

const Select = ({ value, onValueChange, children, defaultValue }: SelectProps) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue || '');
  const currentValue = value !== undefined ? value : internalValue;

  const handleChange = (newValue: string) => {
    setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <SelectContext.Provider value={{ value: currentValue, onChange: handleChange }}>
      {children}
    </SelectContext.Provider>
  );
};

interface SelectContextType {
  value: string;
  onChange: (value: string) => void;
}

const SelectContext = React.createContext<SelectContextType>({ value: '', onChange: () => { } });

const SelectTrigger = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }>(
  ({ className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3eaa76]/50',
          className
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const { value } = React.useContext(SelectContext);
  return <span className={value ? '' : 'text-gray-500'}>{value || placeholder}</span>;
};

const SelectContent = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const SelectItem = ({ value: itemValue, children }: { value: string; children: React.ReactNode }) => {
  const { onChange } = React.useContext(SelectContext);
  return (
    <button
      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      onClick={() => onChange(itemValue)}
    >
      {children}
    </button>
  );
};

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
