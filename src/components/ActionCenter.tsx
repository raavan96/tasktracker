'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Clock,
  Hourglass,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { ActionCenterData, ActionCenterItem } from '@/lib/action-center';

export default function ActionCenter({ data }: { data: ActionCenterData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [acceptedIds, setAcceptedIds] = useState<Record<string, boolean>>({});
  const [mobileTab, setMobileTab] = useState<'needsAction' | 'activeWork' | 'waitingOnOthers'>('needsAction');
  const [isOpen, setIsOpen] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleAccept(acknowledgementId: string, taskId: string) {
    setActionError(null);
    try {
      const res = await fetch('/api/task-acknowledgement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: acknowledgementId }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setActionError(result.error || 'Could not accept task.');
        return;
      }
      setAcceptedIds(prev => ({ ...prev, [taskId]: true }));
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setActionError('Network error while accepting task.');
    }
  }

  // Filter out locally accepted tasks from needsAction
  const effectiveNeedsAction = data.needsAction.filter(t => !acceptedIds[t.id]);
  const needsActionCount = effectiveNeedsAction.length;
  const activeWorkCount = data.counts.activeWork;
  const waitingCount = data.counts.waitingOnOthers;

  const renderItemCard = (item: ActionCenterItem) => {
    return (
      <div
        key={item.id}
        className="group relative rounded-xl border border-gray-200 bg-surface p-3.5 shadow-sm transition hover:border-blue-300 hover:shadow"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-gray-500 truncate block">
              {item.project_name}
            </span>
            <Link
              href={`/dashboard/projects/${item.project_id}?task=${item.id}`}
              className="mt-0.5 block font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 text-sm leading-snug"
            >
              {item.title}
            </Link>
          </div>

          <span
            className="resolution-badge shrink-0"
            data-variant={item.badge_variant}
          >
            {item.badge_label}
          </span>
        </div>

        {/* Context metadata row */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-1.5 text-gray-500">
            {item.due_date ? (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Due {item.due_date}</span>
              </span>
            ) : (
              <span className="text-gray-400">No deadline</span>
            )}
            {item.priority === 'urgent' && (
              <span className="font-semibold text-rose-600">· Urgent</span>
            )}
            {item.priority === 'high' && (
              <span className="font-medium text-amber-600">· High</span>
            )}
          </div>

          {/* Quick CTA depending on action type */}
          {item.action_type === 'accept_needed' && item.acknowledgement_id && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleAccept(item.acknowledgement_id!, item.id)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              <span>Accept</span>
            </button>
          )}

          {item.action_type === 'review_needed' && (
            <Link
              href={`/dashboard/projects/${item.project_id}?task=${item.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              <span>Review work</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}

          {item.action_type === 'unblocked_ready' && (
            <Link
              href={`/dashboard/projects/${item.project_id}?task=${item.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
            >
              <span>Start task</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}

          {['in_progress', 'upcoming', 'waiting_review', 'waiting_blocked'].includes(
            item.action_type
          ) && (
            <Link
              href={`/dashboard/projects/${item.project_id}?task=${item.id}`}
              className="inline-flex items-center text-xs text-gray-500 hover:text-gray-800"
            >
              <span>Open</span>
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <section aria-label="Action center" className="rounded-2xl border border-gray-200 bg-surface shadow-sm">
      {/* Top Header / Greeting Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">My Focus</h2>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                Action Center
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500">
              Welcome back, {data.userName}. Here is what requires your attention today.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Counter Badges */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                needsActionCount > 0
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300'
              }`}
            >
              {needsActionCount > 0 ? (
                <>
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  <span>{needsActionCount} action{needsActionCount > 1 ? 's' : ''}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  <span>All caught up</span>
                </>
              )}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              <span>{activeWorkCount} active</span>
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <span>{waitingCount} waiting</span>
            </span>
          </div>

          <button
            type="button"
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
            title={isOpen ? 'Collapse Action Center' : 'Expand Action Center'}
            aria-label={isOpen ? 'Collapse Action Center' : 'Expand Action Center'}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform motion-reduce:transition-none ${
                isOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs font-medium border-b border-red-100">
          {actionError}
        </div>
      )}

      {/* Main Content Area */}
      {isOpen && (
        <div className="p-4 sm:p-5">
          {/* Mobile Tab Switcher */}
          <div className="mb-4 flex md:hidden rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMobileTab('needsAction')}
              className={`flex-1 rounded-md py-1.5 font-medium transition ${
                mobileTab === 'needsAction'
                  ? 'bg-surface text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600'
              }`}
            >
              Needs Action ({needsActionCount})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('activeWork')}
              className={`flex-1 rounded-md py-1.5 font-medium transition ${
                mobileTab === 'activeWork'
                  ? 'bg-surface text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600'
              }`}
            >
              Active Work ({activeWorkCount})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('waitingOnOthers')}
              className={`flex-1 rounded-md py-1.5 font-medium transition ${
                mobileTab === 'waitingOnOthers'
                  ? 'bg-surface text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600'
              }`}
            >
              Waiting ({waitingCount})
            </button>
          </div>

          {/* 3-Column Cockpit Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Column 1: Needs My Action */}
            <div
              className={`space-y-3 ${
                mobileTab !== 'needsAction' ? 'hidden md:block' : ''
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-gray-900">Needs My Action</h3>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                  {needsActionCount}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Approvals, new assignments, and unblocked work.
              </p>

              <div className="space-y-2.5">
                {effectiveNeedsAction.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 text-center">
                    <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600 dark:text-emerald-400 mb-1" />
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      All caught up!
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                      No reviews or pending actions require you right now.
                    </p>
                  </div>
                ) : (
                  effectiveNeedsAction.map(renderItemCard)
                )}
              </div>
            </div>

            {/* Column 2: My Active Work */}
            <div
              className={`space-y-3 ${
                mobileTab !== 'activeWork' ? 'hidden md:block' : ''
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-gray-900">My Active Work</h3>
                </div>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                  {activeWorkCount}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Tasks currently in progress or upcoming for you.
              </p>

              <div className="space-y-2.5">
                {data.activeWork.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center">
                    <p className="text-xs font-medium text-gray-500">
                      No active work in progress.
                    </p>
                    <Link
                      href="/dashboard/my-tasks"
                      className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Browse your assigned tasks →
                    </Link>
                  </div>
                ) : (
                  data.activeWork.map(renderItemCard)
                )}
              </div>
            </div>

            {/* Column 3: Waiting on Others */}
            <div
              className={`space-y-3 ${
                mobileTab !== 'waitingOnOthers' ? 'hidden md:block' : ''
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-1.5">
                  <Hourglass className="h-4 w-4 text-purple-600" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-gray-900">Waiting on Others</h3>
                </div>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900/50 dark:text-purple-200">
                  {waitingCount}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Work you submitted for review or tasks blocked by others.
              </p>

              <div className="space-y-2.5">
                {data.waitingOnOthers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center">
                    <p className="text-xs font-medium text-gray-500">
                      No handoffs pending teammate action.
                    </p>
                  </div>
                ) : (
                  data.waitingOnOthers.map(renderItemCard)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
