import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme;
      if (stored) return stored;
      
      // Check system preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    
    return 'light';
  });

  // Apply theme immediately on mount and when it changes
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove both classes first to avoid conflicts
    root.classList.remove('dark', 'light');
    
    // Add the current theme class
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      // Apply immediately
      const root = window.document.documentElement;
      root.classList.remove('dark');
      if (newTheme === 'dark') {
        root.classList.add('dark');
      }
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  };

  return { theme, toggleTheme };
}

