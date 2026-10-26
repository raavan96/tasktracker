'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from './IntentLink';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Clock,
  Hourglass,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  Sparkles,
  FileText,
} from 'lucide-react';
import type { ActionCenterData, ActionCenterItem } from '@/lib/action-center';
import DailyStandupModal from '@/components/DailyStandupModal';

export default function ActionCenter({ data,initialOpen=false }: { data: ActionCenterData;initialOpen?:boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [acceptedIds, setAcceptedIds] = useState<Record<string, boolean>>({});
  const [mobileTab, setMobileTab] = useState<'needsAction' | 'activeWork' | 'waitingOnOthers'>('needsAction');
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  useEffect(()=>{const focus=()=>{if(location.hash==='#focus')setIsOpen(true);};focus();window.addEventListener('hashchange',focus);return()=>window.removeEventListener('hashchange',focus);},[]);
  function toggle(){setIsOpen(value=>{document.cookie='tasktracker-focus-'+data.userId+'='+String(!value)+'; Path=/; Max-Age=31536000; SameSite=Lax';return !value;});}
  function renderList(items:ActionCenterItem[],key:string){return <>{(expanded[key]?items:items.slice(0,3)).map(renderItemCard)}{items.length>3&&<button type="button" className="min-h-11 rounded-lg border px-3 py-2 text-sm" onClick={()=>setExpanded(state=>({...state,[key]:!state[key]}))}>{expanded[key]?'Show fewer':`Show all ${items.length}`}</button>}</>;}
  const [isStandupOpen, setIsStandupOpen] = useState(false);
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
              aria-label={`${item.title} (${item.project_name})`}
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
              <span className="task-priority-label font-semibold" data-priority="urgent">· Urgent</span>
            )}
            {item.priority === 'high' && (
              <span className="task-priority-label font-medium" data-priority="high">· High</span>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl action-center-icon-wrap">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">My Focus</h2>
              <span className="action-center-pill px-2 py-0.5 font-semibold" data-variant="blue">
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
              className="action-center-pill px-2.5 py-1 font-semibold gap-1"
              data-variant={needsActionCount > 0 ? 'action' : 'success'}
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

            <span className="action-center-pill px-2.5 py-1 font-medium gap-1" data-variant="blue">
              <span>{activeWorkCount} active</span>
            </span>

            <span className="action-center-pill px-2.5 py-1 font-medium gap-1" data-variant="neutral">
              <span>{waitingCount} waiting</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsStandupOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-surface px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:text-blue-600 hover:border-blue-300 dark:hover:bg-gray-800 transition shadow-sm"
            title="Generate 1-Click Daily Standup & Handoff"
          >
            <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="hidden sm:inline">Daily Standup</span>
            <span className="sm:hidden">Standup</span>
          </button>

          <button
            type="button"
            aria-expanded={isOpen}
            onClick={toggle}
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
                <span className="action-center-pill px-2 py-0.5 font-semibold" data-variant="action">
                  {needsActionCount}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Approvals, new assignments, and unblocked work.
              </p>

              <div className="space-y-2.5">
                {effectiveNeedsAction.length === 0 ? (
                  <div className="rounded-xl p-5 text-center action-center-empty-success">
                    <CheckCircle2 className="mx-auto h-6 w-6 mb-1" aria-hidden="true" />
                    <p className="text-xs font-semibold">
                      All caught up!
                    </p>
                    <p className="mt-0.5 text-xs opacity-90">
                      No reviews or pending actions require you right now.
                    </p>
                  </div>
                ) : (
                  renderList(effectiveNeedsAction,'needsAction')
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
                <span className="action-center-pill px-2 py-0.5 font-semibold" data-variant="blue">
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
                  renderList(data.activeWork,'activeWork')
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
                <span className="action-center-pill px-2 py-0.5 font-semibold" data-variant="purple">
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
                  renderList(data.waitingOnOthers,'waitingOnOthers')
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {isStandupOpen && (
        <DailyStandupModal onClose={() => setIsStandupOpen(false)} />
      )}
    </section>
  );
}
