import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { MEDIA, STORAGE_KEYS, THEMES } from '@/utils/constants';
import { storage } from '@/utils/storage';
import { useMediaQuery } from '@/hooks/useMediaQuery';

// One shared store, so the topbar toggle and the settings page always agree.
const listeners = new Set();

function readStored() {
  const saved = storage.get(STORAGE_KEYS.theme, 'system');
  return THEMES.includes(saved) ? saved : 'system';
}

let current = readStored();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => current;

function setStoredTheme(next) {
  if (!THEMES.includes(next) || next === current) return;
  current = next;
  storage.set(STORAGE_KEYS.theme, next);
  listeners.forEach((listener) => listener());
}

/**
 * theme         what the user chose: 'light' | 'dark' | 'system'
 * resolvedTheme what is shown now: 'light' | 'dark'
 * Puts the "dark" class on <html>, which switches the CSS variables in variables.css.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'system');
  const prefersDark = useMediaQuery(MEDIA.prefersDark);
  const resolvedTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const setTheme = useCallback((next) => setStoredTheme(next), []);
  const toggleTheme = useCallback(
    () => setStoredTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
    [resolvedTheme],
  );

  return { theme, resolvedTheme, setTheme, toggleTheme };
}
