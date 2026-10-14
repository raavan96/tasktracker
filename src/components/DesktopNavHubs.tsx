'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  CheckSquare,
  ListTodo,
  FolderKanban,
  Copy,
  Archive,
  CalendarDays,
  Users,
  ChartNoAxesCombined,
  BarChart3,
  History,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import {
  getNavHubs,
  isHubActive,
  isHubItemActive,
  NavHub,
  NavHubItem,
} from '@/lib/nav-hubs';

interface DesktopNavHubsProps {
  isAdmin: boolean;
}

export default function DesktopNavHubs({ isAdmin }: DesktopNavHubsProps) {
  const pathname = usePathname();
  const hubs = getNavHubs(isAdmin);
  const [openHubId, setOpenHubId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const drawerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpenHubId(null);
  }

  // Click outside to close
  useEffect(() => {
    if (!openHubId) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpenHubId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [openHubId]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, hub: NavHub) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpenHubId(null);
        triggerRefs.current[hub.id]?.focus();
      } else if (event.key === 'ArrowDown' && openHubId === hub.id) {
        event.preventDefault();
        const drawer = drawerRefs.current[hub.id];
        const links = drawer?.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]');
        if (links && links.length > 0) {
          links[0].focus();
        }
      }
    },
    [openHubId]
  );

  const handleItemKeyDown = useCallback(
    (event: React.KeyboardEvent, hubId: string, index: number, total: number) => {
      const drawer = drawerRefs.current[hubId];
      const links = drawer?.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]');
      if (!links) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = (index + 1) % total;
        links[nextIndex]?.focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = (index - 1 + total) % total;
        links[prevIndex]?.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setOpenHubId(null);
        triggerRefs.current[hubId]?.focus();
      }
    },
    []
  );

  const toggleHub = (hubId: string) => {
    setOpenHubId(prev => (prev === hubId ? null : hubId));
  };

  const renderIcon = (iconName: string, className = 'h-4 w-4 shrink-0') => {
    switch (iconName) {
      case 'sparkles':
        return <Sparkles className={className} aria-hidden="true" />;
      case 'check-square':
        return <CheckSquare className={className} aria-hidden="true" />;
      case 'list-todo':
        return <ListTodo className={className} aria-hidden="true" />;
      case 'folder-kanban':
        return <FolderKanban className={className} aria-hidden="true" />;
      case 'copy':
        return <Copy className={className} aria-hidden="true" />;
      case 'archive':
        return <Archive className={className} aria-hidden="true" />;
      case 'calendar-days':
        return <CalendarDays className={className} aria-hidden="true" />;
      case 'users':
        return <Users className={className} aria-hidden="true" />;
      case 'chart-no-axes-combined':
        return <ChartNoAxesCombined className={className} aria-hidden="true" />;
      case 'bar-chart-3':
        return <BarChart3 className={className} aria-hidden="true" />;
      case 'history':
        return <History className={className} aria-hidden="true" />;
      case 'shield-check':
        return <ShieldCheck className={className} aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <nav
      ref={containerRef}
      aria-label="Desktop navigation hubs"
      className="desktop-nav-hubs hidden lg:flex items-center gap-1 shrink-0"
    >
      {hubs.map(hub => {
        const isOpen = openHubId === hub.id;
        const isActive = isHubActive(hub, pathname);

        return (
          <div key={hub.id} className="relative inline-block">
            <button
              ref={el => {
                triggerRefs.current[hub.id] = el;
              }}
              type="button"
              id={`hub-trigger-${hub.id}`}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls={`hub-menu-${hub.id}`}
              onClick={() => toggleHub(hub.id)}
              onKeyDown={e => handleKeyDown(e, hub)}
              data-active={isActive ? 'true' : 'false'}
              data-open={isOpen ? 'true' : 'false'}
              className="desktop-nav-hub-trigger flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer select-none whitespace-nowrap"
            >
              {renderIcon(hub.iconName, 'h-3.5 w-3.5 shrink-0')}
              <span>{hub.label}</span>
              <ChevronDown
                className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {isOpen && (
              <div
                ref={el => {
                  drawerRefs.current[hub.id] = el;
                }}
                id={`hub-menu-${hub.id}`}
                role="menu"
                aria-label={`${hub.label} navigation drawer`}
                className="desktop-nav-hub-drawer absolute top-full left-0 mt-2 w-72 rounded-2xl p-2 z-50 shadow-2xl"
              >
                <div className="space-y-1">
                  {hub.items.map((item: NavHubItem, idx: number) => {
                    const isItemActive = isHubItemActive(item.href, pathname);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        role="menuitem"
                        tabIndex={0}
                        onClick={() => setOpenHubId(null)}
                        onKeyDown={e =>
                          handleItemKeyDown(e, hub.id, idx, hub.items.length)
                        }
                        data-active={isItemActive ? 'true' : 'false'}
                        className="desktop-nav-hub-item flex items-start gap-3 p-2.5 rounded-xl transition"
                      >
                        <span className="desktop-nav-hub-item-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5">
                          {renderIcon(item.iconName, 'h-3.5 w-3.5')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="desktop-nav-hub-item-title text-xs font-semibold">
                              {item.label}
                            </span>
                            {isItemActive && (
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                            )}
                          </div>
                          <p className="desktop-nav-hub-item-desc text-[11px] leading-snug mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
