import { useCallback, useSyncExternalStore } from 'react';

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** true while the CSS media query matches. Use the ready-made queries in MEDIA (constants.js). */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      if (!canMatch()) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  const getSnapshot = () => (canMatch() ? window.matchMedia(query).matches : false);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
