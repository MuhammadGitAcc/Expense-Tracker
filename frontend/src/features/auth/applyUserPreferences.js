import { changeLanguage } from '@/i18n';
import { LANGUAGES, THEMES } from '@/utils/constants';

/**
 * After a login: use the language and theme saved in the profile.
 * `setTheme` comes from useTheme() (it is a hook, so the caller passes it in).
 */
export function applyUserPreferences(user, setTheme) {
  if (!user) return;
  if (LANGUAGES.some((language) => language.code === user.language)) {
    changeLanguage(user.language);
  }
  if (THEMES.includes(user.theme)) setTheme(user.theme);
}
