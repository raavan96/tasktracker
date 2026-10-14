export interface NavHubItem {
  id: string;
  label: string;
  href: string;
  description: string;
  iconName: 'sparkles' | 'check-square' | 'list-todo' | 'folder-kanban' | 'copy' | 'archive' | 'calendar-days' | 'users' | 'chart-no-axes-combined' | 'bar-chart-3' | 'history' | 'shield-check';
  adminOnly?: boolean;
}

export interface NavHub {
  id: string;
  label: string;
  iconName: 'check-square' | 'folder-kanban' | 'calendar-days' | 'bar-chart-3';
  items: NavHubItem[];
}

export const NAV_HUBS: NavHub[] = [
  {
    id: 'hub-work',
    label: 'Work',
    iconName: 'check-square',
    items: [
      {
        id: 'hub-work-focus',
        label: 'Focus',
        href: '/dashboard',
        description: "Today's priority triage & action center",
        iconName: 'sparkles',
      },
      {
        id: 'hub-work-my-tasks',
        label: 'My Tasks',
        href: '/dashboard/my-tasks',
        description: 'Tasks assigned directly to you',
        iconName: 'check-square',
      },
      {
        id: 'hub-work-all-tasks',
        label: 'All Tasks',
        href: '/dashboard/tasks',
        description: 'Team backlog, table & kanban board',
        iconName: 'list-todo',
      },
    ],
  },
  {
    id: 'hub-projects',
    label: 'Projects',
    iconName: 'folder-kanban',
    items: [
      {
        id: 'hub-projects-active',
        label: 'Active Projects',
        href: '/dashboard#projects',
        description: 'Team workspaces, scopes & milestones',
        iconName: 'folder-kanban',
      },
      {
        id: 'hub-projects-templates',
        label: 'Templates',
        href: '/dashboard/templates',
        description: 'Standard workflow blueprints & templates',
        iconName: 'copy',
      },
      {
        id: 'hub-projects-archive',
        label: 'Archive',
        href: '/dashboard/archive',
        description: 'Completed & retired projects or tasks',
        iconName: 'archive',
      },
    ],
  },
  {
    id: 'hub-planning',
    label: 'Planning',
    iconName: 'calendar-days',
    items: [
      {
        id: 'hub-planning-calendar',
        label: 'Calendar',
        href: '/dashboard/calendar',
        description: 'Monthly schedule, deadlines & releases',
        iconName: 'calendar-days',
      },
      {
        id: 'hub-planning-workload',
        label: 'Team Workload',
        href: '/dashboard/workload',
        description: 'Capacity, task distribution & balance',
        iconName: 'users',
        adminOnly: true,
      },
    ],
  },
  {
    id: 'hub-insights',
    label: 'Insights',
    iconName: 'bar-chart-3',
    items: [
      {
        id: 'hub-insights-dashboard',
        label: 'Dashboard',
        href: '/dashboard/insights',
        description: 'Velocity, completion & productivity metrics',
        iconName: 'chart-no-axes-combined',
      },
      {
        id: 'hub-insights-reports',
        label: 'Reports & Export',
        href: '/dashboard/reports',
        description: 'Custom filters, summaries & full CSV exports',
        iconName: 'bar-chart-3',
      },
      {
        id: 'hub-insights-history',
        label: 'Audit History',
        href: '/dashboard/history',
        description: 'Immutable record of task changes & approvals',
        iconName: 'history',
      },
      {
        id: 'hub-insights-team',
        label: 'Team Users',
        href: '/admin/users',
        description: 'User access, credentials & role permissions',
        iconName: 'shield-check',
        adminOnly: true,
      },
    ],
  },
];

export function getNavHubs(isAdmin: boolean): NavHub[] {
  return NAV_HUBS.map(hub => ({
    ...hub,
    items: hub.items.filter(item => !item.adminOnly || isAdmin),
  }));
}

export function isHubItemActive(itemHref: string, currentPath: string): boolean {
  const cleanPath = currentPath.split('?')[0].split('#')[0];
  const cleanItem = itemHref.split('?')[0].split('#')[0];
  if (cleanItem === '/dashboard') {
    if (itemHref === '/dashboard') {
      return cleanPath === '/dashboard';
    }
    return cleanPath === '/dashboard' || cleanPath.startsWith('/dashboard/projects');
  }
  return cleanPath === cleanItem || cleanPath.startsWith(cleanItem + '/');
}

export function isHubActive(hub: NavHub, currentPath: string): boolean {
  return hub.items.some(item => isHubItemActive(item.href, currentPath));
}
