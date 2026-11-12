import { useSyncExternalStore } from 'react';
import { TOAST } from '@/utils/constants';

// A small shared store: `toast.success(...)` also works outside React (for example in the API client).
let toasts = [];
let nextId = 1;
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => toasts;

function dismiss(id) {
  if (!toasts.some((item) => item.id === id)) return;
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

function clear() {
  if (toasts.length === 0) return;
  toasts = [];
  emit();
}

function add(type, message, { title, durationMs } = {}) {
  const id = nextId++;
  const duration = durationMs ?? (type === 'error' ? TOAST.errorDurationMs : TOAST.durationMs);
  toasts = [...toasts, { id, type, title, message }].slice(-TOAST.maxVisible);
  emit();
  if (duration > 0) setTimeout(() => dismiss(id), duration);
  return id;
}

/** Messages must already be translated: toast.success(t('expenses.saved')). */
export const toast = {
  success: (message, options) => add('success', message, options),
  error: (message, options) => add('error', message, options),
  info: (message, options) => add('info', message, options),
  warning: (message, options) => add('warning', message, options),
  dismiss,
  clear,
};

export function useToast() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { toasts: items, toast, dismiss, clear };
}
