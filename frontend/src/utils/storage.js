/**
 * Safe wrapper around localStorage: values are stored as JSON, and a blocked or full storage
 * never throws. Use it only for preferences (theme, language). NEVER store tokens here: the
 * access token lives in memory and the refresh token is an httpOnly cookie.
 */
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // storage is blocked: nothing to remove
    }
  },
};
