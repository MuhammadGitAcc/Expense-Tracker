import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';

// Redux holds only app state (who is logged in, later the layout state).
// Data that comes from the server lives in TanStack Query, not here.
export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});
