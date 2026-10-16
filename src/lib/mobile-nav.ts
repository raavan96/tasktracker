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
    href: '/dashboard/my-tasks#focus',
    iconName: 'sparkles',
  },
  {
    id: 'mobile-nav-my-tasks',
    label: 'My Tasks',
    href: '/dashboard/my-tasks#tasks',
    iconName: 'check',
  },
  {
    id: 'mobile-nav-projects',
    label: 'Projects',
    href: '/dashboard',
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

export function isMobileNavActive(
  itemHref: string | undefined,
  currentPath: string,
  currentHash?: string
): boolean {
  if (!itemHref) return false;

  // Extract path and hash from itemHref
  const [itemPath, itemHash] = itemHref.split('#');

  // Extract path and hash from currentPath if currentPath contains hash
  let activePath = currentPath;
  let activeHash = currentHash || '';
  if (currentPath.includes('#')) {
    const parts = currentPath.split('#');
    activePath = parts[0];
    if (!activeHash) {
      activeHash = '#' + parts[1];
    }
  }

  // Normalize activeHash
  if (activeHash && !activeHash.startsWith('#')) {
    activeHash = '#' + activeHash;
  }

  // Projects item (/dashboard or legacy /dashboard#projects)
  if (itemPath === '/dashboard') {
    return activePath === '/dashboard' || activePath.startsWith('/dashboard/projects');
  }

  // Focus item (/dashboard/my-tasks#focus)
  if (itemPath === '/dashboard/my-tasks' && itemHash === 'focus') {
    if (activePath !== '/dashboard/my-tasks') return false;
    return activeHash === '#focus';
  }

  // My Tasks item (/dashboard/my-tasks#tasks or /dashboard/my-tasks)
  if (itemPath === '/dashboard/my-tasks' && (itemHash === 'tasks' || !itemHash)) {
    if (activePath !== '/dashboard/my-tasks') return false;
    // Active if hash is #tasks OR default on /dashboard/my-tasks when hash is not #focus
    return activeHash === '#tasks' || activeHash === '' || !activeHash;
  }

  // Exact or prefix match for other routes
  return activePath === itemPath || activePath.startsWith(itemPath + '/');
}

export function formatUnreadBadge(count: number): string | null {
  if (!count || count <= 0) return null;
  if (count > 9) return '9+';
  return String(count);
}
