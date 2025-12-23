
import { useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('vinyl_theme') as ThemeMode) || 'system';
  });
  
  // Synchronously initialize dark mode state to match system/storage immediately
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = (localStorage.getItem('vinyl_theme') as ThemeMode) || 'system';
    if (savedMode === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return savedMode === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('vinyl_theme', themeMode);
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const resolveTheme = () => {
        if (themeMode === 'system') return mediaQuery.matches;
        return themeMode === 'dark';
    };

    setIsDarkMode(resolveTheme());

    const handler = (e: MediaQueryListEvent) => {
        if (themeMode === 'system') {
            setIsDarkMode(e.matches);
        }
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themeMode]);

  const toggleTheme = () => {
      const modes: ThemeMode[] = ['dark', 'light', 'system'];
      const next = modes[(modes.indexOf(themeMode) + 1) % modes.length];
      setThemeMode(next);
  };

  return { themeMode, isDarkMode, toggleTheme };
}
