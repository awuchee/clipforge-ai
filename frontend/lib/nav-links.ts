import { LayoutDashboard, Settings, CreditCard, type LucideIcon } from 'lucide-react';

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Projects', icon: LayoutDashboard },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];
