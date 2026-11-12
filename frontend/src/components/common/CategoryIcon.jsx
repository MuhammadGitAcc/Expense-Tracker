import {
  Banknote,
  Baby,
  Book,
  Briefcase,
  Bus,
  Car,
  Coffee,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
} from 'lucide-react';
import { cn } from '@/utils/cn';

// The API stores an icon as a plain name ("shopping-bag"). This is the one place that turns it
// into a component. The order here is the order of the icon picker in the category form.
export const CATEGORY_ICONS = {
  tag: Tag,
  utensils: Utensils,
  coffee: Coffee,
  car: Car,
  bus: Bus,
  fuel: Fuel,
  home: Home,
  receipt: Receipt,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  shirt: Shirt,
  'heart-pulse': HeartPulse,
  dumbbell: Dumbbell,
  film: Film,
  music: Music,
  'gamepad-2': Gamepad2,
  'graduation-cap': GraduationCap,
  book: Book,
  plane: Plane,
  gift: Gift,
  baby: Baby,
  'paw-print': PawPrint,
  smartphone: Smartphone,
  wifi: Wifi,
  wrench: Wrench,
  briefcase: Briefcase,
  laptop: Laptop,
  'trending-up': TrendingUp,
  'piggy-bank': PiggyBank,
  wallet: Wallet,
  banknote: Banknote,
  landmark: Landmark,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

/** A round colored badge with the category icon. Unknown icon names fall back to "tag". */
export function CategoryIcon({ icon, color = '#6B7280', size = 'md', className }) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag;
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const glyph = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full', box, className)}
      // The category color is data from the API, so it is applied as an inline style.
      style={{ backgroundColor: `${color}26`, color }}
      aria-hidden="true"
    >
      <Icon className={glyph} />
    </span>
  );
}
