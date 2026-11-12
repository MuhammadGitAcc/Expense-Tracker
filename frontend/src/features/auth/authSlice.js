import { createSlice } from '@reduxjs/toolkit';

// Memory only: nothing here is saved to localStorage (the access token must never be).
const initialState = {
  user: null,
  accessToken: null,
  // true until the first "am I still logged in?" check (the refresh call at start-up) is finished
  initializing: true,
  // true when a logged-in session ended because the refresh token was refused (show a message)
  sessionExpired: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** After login, verify-email and a successful refresh: payload = { user, accessToken }. */
    setCredentials(state, { payload }) {
      state.user = payload.user;
      state.accessToken = payload.accessToken;
      state.initializing = false;
      state.sessionExpired = false;
    },
    /** After a profile update: payload = the public user from the API. */
    updateUser(state, { payload }) {
      state.user = payload;
    },
    /** The start-up check finished without a session. */
    sessionChecked(state) {
      state.initializing = false;
    },
    /** Normal logout, or no session at all. */
    clearCredentials(state) {
      state.user = null;
      state.accessToken = null;
      state.initializing = false;
    },
    /** A session that was running was refused by the server: log out and remember why. */
    expireSession(state) {
      state.user = null;
      state.accessToken = null;
      state.initializing = false;
      state.sessionExpired = true;
    },
    dismissSessionExpired(state) {
      state.sessionExpired = false;
    },
  },
});

export const {
  setCredentials,
  updateUser,
  sessionChecked,
  clearCredentials,
  expireSession,
  dismissSessionExpired,
} = authSlice.actions;

export const selectUser = (state) => state.auth.user;
export const selectAccessToken = (state) => state.auth.accessToken;
export const selectIsAuthenticated = (state) => Boolean(state.auth.accessToken && state.auth.user);
export const selectIsInitializing = (state) => state.auth.initializing;
export const selectSessionExpired = (state) => state.auth.sessionExpired;

export default authSlice.reducer;
