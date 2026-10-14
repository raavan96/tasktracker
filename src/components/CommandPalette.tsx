'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Moon,
  Sun,
  MessagesSquare,
  Folder,
  FolderKanban,
  CheckSquare,
  Calendar,
  Bell,
  BarChart3,
  Users,
  History,
  Archive,
  Search,
  ArrowRight,
  CornerDownLeft,
  X,
  Loader2,
} from 'lucide-react';
import {
  type CommandItem,
  type CommandCategory,
  type CommandIconName,
  getStaticCommands,
  filterAndRankCommands,
  groupCommandsByCategory,
  getNextSelectableIndex,
} from '@/lib/command-palette-items';
import { useTheme } from './ThemeProvider';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onOpenStandup: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  isAdmin,
  onOpenStandup,
}: CommandPaletteProps) {
  const router = useRouter();
  const themeContext = useTheme();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [dynamicItems, setDynamicItems] = useState<{
    projects: CommandItem[];
    tasks: CommandItem[];
    notes: CommandItem[];
  }>({ projects: [], tasks: [], notes: [] });
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Base static commands
  const staticCommands = useMemo(() => getStaticCommands({ isAdmin }), [isAdmin]);

  // Filtered static commands based on user query
  const filteredStatic = useMemo(
    () => filterAndRankCommands(staticCommands, query),
    [staticCommands, query]
  );

  // Combined flat list of all active items
  const allItems = useMemo(() => {
    return [
      ...filteredStatic,
      ...dynamicItems.projects,
      ...dynamicItems.tasks,
      ...dynamicItems.notes,
    ];
  }, [filteredStatic, dynamicItems]);

  // Grouped for display
  const groupedItems = useMemo(() => groupCommandsByCategory(allItems), [allItems]);

  // Flattened mapping to find items by overall linear index
  const flatItemsList = useMemo(() => {
    const list: CommandItem[] = [];
    for (const group of groupedItems) {
      for (const item of group.items) {
        list.push(item);
      }
    }
    return list;
  }, [groupedItems]);

  // When palette mounts, autofocus input and load recent items
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadInitial() {
      try {
        const res = await fetch('/api/command-palette', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.success) {
          setDynamicItems({
            projects: data.projects || [],
            tasks: data.tasks || [],
            notes: data.notes || [],
          });
        }
      } catch {
        // Ignore abort
      }
    }

    void loadInitial();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (!query.trim()) {
      return;
    }
    let active = true;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await fetch(
          `/api/command-palette?q=${encodeURIComponent(query.trim())}`,
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.success) {
          setDynamicItems({
            projects: data.projects || [],
            tasks: data.tasks || [],
            notes: data.notes || [],
          });
        }
      } catch {
        // Ignore abort
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }, 120);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Auto-scroll selected item into view
  useEffect(() => {
    const currentEl = itemRefs.current[activeIndex];
    if (currentEl) {
      currentEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Execute selected command
  const executeItem = useCallback(
    (item: CommandItem) => {
      onClose();

      if (item.actionId === 'standup') {
        onOpenStandup();
      } else if (item.actionId === 'theme') {
        themeContext?.toggle();
      } else if (item.actionId === 'chat') {
        window.dispatchEvent(
          new CustomEvent('tasktracker:open-chat', { detail: { id: '' } })
        );
      } else if (item.actionId === 'new_project') {
        router.push('/dashboard?create=project');
      } else if (item.actionId === 'search') {
        router.push(
          '/dashboard/search' + (query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '')
        );
      } else if (item.url) {
        router.push(item.url);
      }
    },
    [onClose, onOpenStandup, themeContext, router, query]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => getNextSelectableIndex(prev, 1, flatItemsList.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => getNextSelectableIndex(prev, -1, flatItemsList.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItemsList[activeIndex]) {
        executeItem(flatItemsList[activeIndex]);
      }
    }
  };

  const renderIcon = (iconName?: CommandIconName, category?: CommandCategory) => {
    const className = 'h-4 w-4 shrink-0';
    switch (iconName) {
      case 'sparkles':
        return <Sparkles className={className} />;
      case 'moon':
        return themeContext?.theme === 'dark' ? (
          <Sun className={className} />
        ) : (
          <Moon className={className} />
        );
      case 'sun':
        return <Sun className={className} />;
      case 'chat':
        return <MessagesSquare className={className} />;
      case 'folder':
        return <FolderKanban className={className} />;
      case 'task':
        return <CheckSquare className={className} />;
      case 'calendar':
        return <Calendar className={className} />;
      case 'bell':
        return <Bell className={className} />;
      case 'reports':
        return <BarChart3 className={className} />;
      case 'workload':
        return <Users className={className} />;
      case 'history':
        return <History className={className} />;
      case 'archive':
        return <Archive className={className} />;
      case 'search':
        return <Search className={className} />;
      case 'check':
        return <CheckSquare className={className} />;
      default:
        return category === 'Projects' ? (
          <Folder className={className} />
        ) : (
          <ArrowRight className={className} />
        );
    }
  };

  if (!isOpen) return null;

  let currentLinearIndex = 0;

  return (
    <div
      className="command-palette-backdrop fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 md:pt-20"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="command-palette-modal w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl transition-all"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="command-palette-search-bar relative flex items-center border-b px-4 py-3.5">
          <Search className="command-palette-search-icon h-5 w-5 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={flatItemsList[activeIndex]?.id}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type a command, search projects, tasks, or jump to page…"
            className="command-palette-input ml-3 flex-1 bg-transparent text-sm sm:text-base outline-none"
          />
          {isLoading && (
            <Loader2
              className="command-palette-loader mr-2 h-4 w-4 animate-spin"
              aria-label="Searching…"
            />
          )}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setActiveIndex(0);
                inputRef.current?.focus();
              }}
              aria-label="Clear query"
              className="command-palette-clear-btn p-1 rounded-md transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          aria-label="Available commands and search results"
          className="command-palette-list max-h-[60vh] overflow-y-auto p-2"
        >
          {flatItemsList.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p className="text-sm font-medium command-palette-empty-title">
                No matching commands or items
              </p>
              <p className="text-xs command-palette-empty-sub mt-1">
                Try searching for “standup”, “calendar”, a task title, or project name.
              </p>
            </div>
          ) : (
            groupedItems.map(group => (
              <div key={group.category} className="mb-2">
                <div
                  className="command-palette-section-header px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
                  id={`cat-header-${group.category}`}
                >
                  {group.category}
                </div>
                <div role="group" aria-labelledby={`cat-header-${group.category}`}>
                  {group.items.map(item => {
                    const itemIndex = currentLinearIndex++;
                    const isSelected = itemIndex === activeIndex;

                    return (
                      <div
                        key={item.id}
                        ref={el => {
                          itemRefs.current[itemIndex] = el;
                        }}
                        id={item.id}
                        role="option"
                        aria-selected={isSelected}
                        data-selected={isSelected ? 'true' : 'false'}
                        onClick={() => executeItem(item)}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        className="command-palette-item group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="command-palette-icon-wrap flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                            aria-hidden="true"
                          >
                            {renderIcon(item.iconName, item.category)}
                          </span>
                          <div className="min-w-0">
                            <div className="command-palette-item-title truncate text-sm font-medium">
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div className="command-palette-item-sub truncate text-xs">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {item.badge && (
                            <span className="command-palette-badge rounded-md px-2 py-0.5 text-xs font-medium">
                              {item.badge}
                            </span>
                          )}
                          {isSelected && (
                            <CornerDownLeft
                              className="command-palette-enter-icon h-4 w-4 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="command-palette-footer flex items-center justify-between border-t px-4 py-2.5 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="command-palette-kbd">↑</kbd>
              <kbd className="command-palette-kbd">↓</kbd>
              <span className="command-palette-footer-text">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="command-palette-kbd">↵</kbd>
              <span className="command-palette-footer-text">Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="command-palette-kbd">Esc</kbd>
              <span className="command-palette-footer-text">Close</span>
            </span>
          </div>

          <span className="command-palette-footer-count hidden sm:inline">
            {flatItemsList.length} {flatItemsList.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>
    </div>
  );
}
