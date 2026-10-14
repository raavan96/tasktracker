'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  CheckSquare,
  FolderKanban,
  Bell,
  Search,
} from 'lucide-react';
import {
  MOBILE_NAV_ITEMS,
  isMobileNavActive,
  formatUnreadBadge,
} from '@/lib/mobile-nav';

interface MobileBottomNavProps {
  unreadCount?: number;
}

export default function MobileBottomNav({ unreadCount = 0 }: MobileBottomNavProps) {
  const pathname = usePathname();
  const unreadBadgeText = formatUnreadBadge(unreadCount);

  const handleJumpClick = () => {
    window.dispatchEvent(new CustomEvent('tasktracker:open-command-palette'));
  };

  const renderIcon = (iconName: string, className: string) => {
    switch (iconName) {
      case 'sparkles':
        return <Sparkles className={className} aria-hidden="true" />;
      case 'check':
        return <CheckSquare className={className} aria-hidden="true" />;
      case 'folder':
        return <FolderKanban className={className} aria-hidden="true" />;
      case 'bell':
        return <Bell className={className} aria-hidden="true" />;
      case 'search':
        return <Search className={className} aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="mobile-bottom-nav fixed bottom-0 inset-x-0 z-40 md:hidden"
    >
      <div className="mobile-bottom-nav-inner flex items-center justify-around px-2 py-1.5">
        {MOBILE_NAV_ITEMS.map(item => {
          const isActive = isMobileNavActive(item.href, pathname);
          const iconClass = 'h-5 w-5 shrink-0 transition-transform';

          if (item.isAction) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={handleJumpClick}
                aria-label="Search or jump to command"
                className="mobile-bottom-nav-item flex flex-col items-center justify-center min-w-[56px] min-h-[48px] rounded-xl px-2 py-1 text-center transition"
              >
                <span className="mobile-bottom-nav-icon-wrap relative flex items-center justify-center px-2.5 py-0.5 rounded-full">
                  {renderIcon(item.iconName, iconClass)}
                </span>
                <span className="mobile-bottom-nav-label text-[10px] font-medium mt-0.5 tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href || '/dashboard'}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              data-active={isActive ? 'true' : 'false'}
              className="mobile-bottom-nav-item flex flex-col items-center justify-center min-w-[56px] min-h-[48px] rounded-xl px-2 py-1 text-center transition relative"
            >
              <span className="mobile-bottom-nav-icon-wrap relative flex items-center justify-center px-2.5 py-0.5 rounded-full">
                {renderIcon(item.iconName, iconClass)}
                {item.id === 'mobile-nav-inbox' && unreadBadgeText && (
                  <span
                    aria-label={`${unreadCount} unread notifications`}
                    className="mobile-bottom-nav-badge absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none"
                  >
                    {unreadBadgeText}
                  </span>
                )}
              </span>
              <span className="mobile-bottom-nav-label text-[10px] font-medium mt-0.5 tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
