'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
        <Monitor className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>
    );
  }

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      title={`Theme: ${theme}`}
    >
      {theme === 'dark' ? (
        <Moon className="w-5 h-5 text-blue-500" />
      ) : theme === 'light' ? (
        <Sun className="w-5 h-5 text-yellow-500" />
      ) : (
        <Monitor className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      )}
    </button>
  );
}
