export interface MobileNavItem {
  id: string;
  label: string;
  href?: string;
  iconName: 'sparkles' | 'check' | 'folder' | 'bell' | 'search';
  isAction?: boolean;
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  {
    id: 'mobile-nav-focus',
    label: 'Focus',
    href: '/dashboard',
    iconName: 'sparkles',
  },
  {
    id: 'mobile-nav-my-tasks',
    label: 'My Tasks',
    href: '/dashboard/my-tasks',
    iconName: 'check',
  },
  {
    id: 'mobile-nav-projects',
    label: 'Projects',
    href: '/dashboard#projects',
    iconName: 'folder',
  },
  {
    id: 'mobile-nav-inbox',
    label: 'Inbox',
    href: '/dashboard/notifications',
    iconName: 'bell',
  },
  {
    id: 'mobile-nav-jump',
    label: 'Jump',
    iconName: 'search',
    isAction: true,
  },
];

export function isMobileNavActive(itemHref: string | undefined, currentPath: string): boolean {
  if (!itemHref) return false;

  // Exact match for /dashboard
  if (itemHref === '/dashboard' || itemHref === '/dashboard#projects') {
    if (itemHref === '/dashboard') {
      return currentPath === '/dashboard';
    }
    // For Projects, active on project pages or dashboard projects anchor
    return currentPath.startsWith('/dashboard/projects');
  }

  // Exact or prefix match for other routes
  return currentPath === itemHref || currentPath.startsWith(itemHref + '/');
}

export function formatUnreadBadge(count: number): string | null {
  if (!count || count <= 0) return null;
  if (count > 9) return '9+';
  return String(count);
}
