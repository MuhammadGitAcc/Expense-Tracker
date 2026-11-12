import { useCallback, useEffect, useRef, useState } from 'react';
import { storage } from '@/utils/storage';

/** Like useState, but the value is kept in localStorage and follows changes from other tabs. */
export function useLocalStorage(key, initialValue) {
  const initialRef = useRef(initialValue);
  const [value, setValue] = useState(() => storage.get(key, initialRef.current));

  const set = useCallback(
    (next) => {
      setValue((previous) => {
        const resolved = typeof next === 'function' ? next(previous) : next;
        storage.set(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  const remove = useCallback(() => {
    storage.remove(key);
    setValue(initialRef.current);
  }, [key]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === key) setValue(storage.get(key, initialRef.current));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [value, set, remove];
}
