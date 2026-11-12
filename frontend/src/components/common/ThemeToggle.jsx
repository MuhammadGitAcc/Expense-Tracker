import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';

/**
 * One button for the topbar: switches between light and dark.
 * The icon shows what a click will switch TO. The three-way choice (light / dark / system)
 * comes with the Preferences tab in Phase 10 (useTheme().setTheme).
 */
export function ThemeToggle({ className }) {
  const { t } = useTranslation();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      onClick={toggleTheme}
    >
      {isDark ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </Button>
  );
}
