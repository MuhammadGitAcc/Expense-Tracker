import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  CalendarClock,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Tags,
  Wallet,
} from 'lucide-react';
import { PATHS } from '@/routes/paths';

// One list for the sidebar, the slide-over menu and the bottom bar.
export const NAV_ITEMS = [
  { to: PATHS.dashboard, labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: PATHS.expenses, labelKey: 'nav.expenses', icon: ArrowUpFromLine },
  { to: PATHS.income, labelKey: 'nav.income', icon: ArrowDownToLine },
  { to: PATHS.accounts, labelKey: 'nav.accounts', icon: Wallet },
  { to: PATHS.categories, labelKey: 'nav.categories', icon: Tags },
  { to: PATHS.budgets, labelKey: 'nav.budgets', icon: PiggyBank },
  { to: PATHS.recurring, labelKey: 'nav.recurring', icon: CalendarClock },
  { to: PATHS.reports, labelKey: 'nav.reports', icon: BarChart3 },
  { to: PATHS.notifications, labelKey: 'nav.notifications', icon: Bell },
  { to: PATHS.settings, labelKey: 'nav.settings', icon: Settings },
];

// The four most used screens go in the phone bottom bar; "More" opens the rest.
export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) =>
  [PATHS.dashboard, PATHS.expenses, PATHS.income, PATHS.budgets].includes(item.to),
);
