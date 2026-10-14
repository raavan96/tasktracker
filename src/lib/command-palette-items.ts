export type CommandCategory = 'Actions' | 'Navigation' | 'Projects' | 'Tasks' | 'Notes';

export type CommandActionId = 'standup' | 'theme' | 'chat' | 'search' | 'new_project';

export type CommandIconName =
  | 'sparkles'
  | 'moon'
  | 'sun'
  | 'chat'
  | 'folder'
  | 'task'
  | 'calendar'
  | 'bell'
  | 'reports'
  | 'workload'
  | 'history'
  | 'archive'
  | 'search'
  | 'check';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: CommandCategory;
  url?: string;
  actionId?: CommandActionId;
  badge?: string;
  keywords?: string[];
  iconName?: CommandIconName;
}

export function getStaticCommands({ isAdmin }: { isAdmin: boolean }): CommandItem[] {
  const actions: CommandItem[] = [
    {
      id: 'action-standup',
      title: 'Generate Daily Standup / Handoff',
      subtitle: 'Export Slack, Markdown, or share to project chat',
      category: 'Actions',
      actionId: 'standup',
      badge: 'Time Saver',
      keywords: ['standup', 'handoff', 'daily', 'slack', 'markdown', 'summary', 'status'],
      iconName: 'sparkles',
    },
    {
      id: 'action-theme',
      title: 'Toggle Dark / Light Mode',
      subtitle: 'Switch between light and dark appearance',
      category: 'Actions',
      actionId: 'theme',
      badge: 'Appearance',
      keywords: ['theme', 'dark', 'light', 'mode', 'color', 'appearance'],
      iconName: 'moon',
    },
    {
      id: 'action-chat',
      title: 'Open Team Chat',
      subtitle: 'Direct messages and project discussions',
      category: 'Actions',
      actionId: 'chat',
      badge: 'Chat',
      keywords: ['chat', 'message', 'dm', 'discussion', 'team'],
      iconName: 'chat',
    },
    {
      id: 'action-new-project',
      title: 'Create New Project',
      subtitle: 'Start a new project with team members',
      category: 'Actions',
      url: '/dashboard?create=project',
      actionId: 'new_project',
      badge: 'Project',
      keywords: ['new', 'project', 'create', 'add'],
      iconName: 'folder',
    },
  ];

  const navigation: CommandItem[] = [
    {
      id: 'nav-focus',
      title: 'My Focus / Action Center',
      subtitle: 'Your pending reviews, unblocked tasks, and today’s work',
      category: 'Navigation',
      url: '/dashboard',
      keywords: ['focus', 'action', 'center', 'home', 'dashboard', 'reviews', 'sla'],
      iconName: 'sparkles',
    },
    {
      id: 'nav-my-tasks',
      title: 'My Tasks',
      subtitle: 'Tasks assigned to you',
      category: 'Navigation',
      url: '/dashboard/my-tasks',
      keywords: ['tasks', 'mine', 'assigned', 'my tasks', 'todo'],
      iconName: 'check',
    },
    {
      id: 'nav-all-tasks',
      title: 'All Tasks',
      subtitle: 'Team-wide task list and filters',
      category: 'Navigation',
      url: '/dashboard/tasks',
      keywords: ['all tasks', 'everything', 'tasks', 'list', 'filter'],
      iconName: 'task',
    },
    {
      id: 'nav-calendar',
      title: 'Calendar & Deadlines',
      subtitle: 'Deadlines and scheduled deliverables',
      category: 'Navigation',
      url: '/dashboard/calendar',
      keywords: ['calendar', 'dates', 'deadlines', 'due', 'schedule'],
      iconName: 'calendar',
    },
    {
      id: 'nav-notifications',
      title: 'Notifications',
      subtitle: 'Inbox alerts, reviews, mentions, and assignments',
      category: 'Navigation',
      url: '/dashboard/notifications',
      keywords: ['notifications', 'alerts', 'inbox', 'bell', 'unread'],
      iconName: 'bell',
    },
    {
      id: 'nav-reports',
      title: 'Reports & Completion Trends',
      subtitle: 'SLA metrics, team velocity, and CSV exports',
      category: 'Navigation',
      url: '/dashboard/reports',
      keywords: ['reports', 'analytics', 'sla', 'velocity', 'trends', 'metrics', 'export'],
      iconName: 'reports',
    },
    {
      id: 'nav-planning',
      title: 'Planning & Timeline',
      subtitle: 'Project milestones and capacity planning',
      category: 'Navigation',
      url: '/dashboard/planning',
      keywords: ['planning', 'milestones', 'timeline', 'capacity', 'roadmap'],
      iconName: 'calendar',
    },
    {
      id: 'nav-history',
      title: 'Activity History',
      subtitle: 'Audit log of workspace updates and changes',
      category: 'Navigation',
      url: '/dashboard/history',
      keywords: ['history', 'audit', 'activity', 'log', 'changes'],
      iconName: 'history',
    },
    {
      id: 'nav-archive',
      title: 'Archived Projects & Tasks',
      subtitle: 'Completed or archived workspace items',
      category: 'Navigation',
      url: '/dashboard/archive',
      keywords: ['archive', 'archived', 'trash', 'old', 'completed'],
      iconName: 'archive',
    },
    ...(isAdmin
      ? [
          {
            id: 'nav-workload',
            title: 'Team Workload',
            subtitle: 'Capacity and distribution across team members',
            category: 'Navigation' as CommandCategory,
            url: '/dashboard/workload',
            keywords: ['workload', 'capacity', 'team', 'members', 'allocation'],
            iconName: 'workload' as CommandIconName,
          },
          {
            id: 'nav-users',
            title: 'Team Users Management',
            subtitle: 'Administer workspace members, roles, and access',
            category: 'Navigation' as CommandCategory,
            url: '/admin/users',
            keywords: ['users', 'members', 'admin', 'roles', 'permissions'],
            iconName: 'workload' as CommandIconName,
          },
        ]
      : []),
    {
      id: 'nav-search',
      title: 'Deep Search Workspace',
      subtitle: 'Full-text search in projects, tasks, notes, and remarks',
      category: 'Navigation',
      url: '/dashboard/search',
      keywords: ['search', 'find', 'lookup', 'query', 'deep search'],
      iconName: 'search',
    },
  ];

  return [...actions, ...navigation];
}

export function filterAndRankCommands(items: CommandItem[], query: string): CommandItem[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return items;

  const scored: { item: CommandItem; score: number }[] = [];

  for (const item of items) {
    const title = item.title.toLowerCase();
    const subtitle = (item.subtitle || '').toLowerCase();
    const keywords = (item.keywords || []).map(k => k.toLowerCase());

    let score = -1;

    // Exact title match
    if (title === clean) {
      score = 100;
    }
    // Title starts with query
    else if (title.startsWith(clean)) {
      score = 80;
    }
    // Word inside title starts with query
    else if (title.includes(' ' + clean)) {
      score = 60;
    }
    // Substring in title
    else if (title.includes(clean)) {
      score = 40;
    }
    // Keyword starts with query or matches
    else if (keywords.some(k => k === clean || k.startsWith(clean))) {
      score = 30;
    }
    // Keyword contains query
    else if (keywords.some(k => k.includes(clean))) {
      score = 20;
    }
    // Subtitle contains query
    else if (subtitle.includes(clean)) {
      score = 10;
    }

    if (score >= 0) {
      scored.push({ item, score });
    }
  }

  // Sort by score descending, then by title ascending
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.title.localeCompare(b.item.title);
  });

  return scored.map(s => s.item);
}

export function groupCommandsByCategory(
  items: CommandItem[]
): { category: CommandCategory; items: CommandItem[] }[] {
  const order: CommandCategory[] = ['Actions', 'Navigation', 'Projects', 'Tasks', 'Notes'];
  const map = new Map<CommandCategory, CommandItem[]>();

  for (const item of items) {
    const list = map.get(item.category) || [];
    list.push(item);
    map.set(item.category, list);
  }

  const result: { category: CommandCategory; items: CommandItem[] }[] = [];
  for (const cat of order) {
    const list = map.get(cat);
    if (list && list.length > 0) {
      result.push({ category: cat, items: list });
    }
  }

  return result;
}

export function getNextSelectableIndex(currentIndex: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  const next = currentIndex + delta;
  if (next < 0) return total - 1;
  if (next >= total) return 0;
  return next;
}
