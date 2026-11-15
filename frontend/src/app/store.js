import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import uiReducer from '@/features/ui/uiSlice';
import { STORAGE_KEYS } from '@/utils/constants';
import { storage } from '@/utils/storage';

// Redux holds only app state (who is logged in, later the layout state).
// Data that comes from the server lives in TanStack Query, not here.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
  },
});

// Remembers in this browser that someone is logged in (a yes, never a token), so the start-up
// check asks the server only for them and a new visitor goes to login with no failed request.
let hadUser = false;
store.subscribe(() => {
  const hasUser = Boolean(store.getState().auth.user);
  if (hasUser === hadUser) return;
  hadUser = hasUser;
  if (hasUser) storage.set(STORAGE_KEYS.hasSession, true);
  else storage.remove(STORAGE_KEYS.hasSession);
});
