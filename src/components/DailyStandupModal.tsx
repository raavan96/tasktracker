'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import Modal from '@/components/Modal';
import {
  formatDailyStandup,
  type DailyStandupData,
  type StandupFormat,
} from '@/lib/standup-format';
import {
  Copy,
  Check,
  Download,
  Send,
  Sparkles,
  AlertCircle,
  Clock,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface DailyStandupModalProps {
  onClose: () => void;
  initialData?: DailyStandupData | null;
}

export default function DailyStandupModal({
  onClose,
  initialData,
}: DailyStandupModalProps) {
  const [data, setData] = useState<DailyStandupData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [format, setFormat] = useState<StandupFormat>('slack');
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [extraNotes, setExtraNotes] = useState({
    accomplished: '',
    workingOn: '',
    blockers: '',
  });

  const [copied, setCopied] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    () => initialData?.projects?.[0]?.id || ''
  );
  const [isSharing, startSharingTransition] = useTransition();
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  // Fetch standup data if not provided
  useEffect(() => {
    if (!initialData) {
      fetch('/api/standup')
        .then(res => res.json())
        .then(res => {
          if (res.data) {
            setData(res.data);
            if (res.data.projects?.length > 0) {
              setSelectedProjectId(res.data.projects[0].id);
            }
          } else {
            setFetchError(res.error || 'Failed to load standup data.');
          }
        })
        .catch(() => setFetchError('Network error while loading standup.'))
        .finally(() => setLoading(false));
    }
  }, [initialData]);

  // Generate live formatted output text
  const generatedText = useMemo(() => {
    if (!data) return '';
    return formatDailyStandup(data, {
      format,
      excludedIds,
      extraNotes,
    });
  }, [data, format, excludedIds, extraNotes]);

  const [customText, setCustomText] = useState<string | null>(null);
  const displayText = customText !== null ? customText : generatedText;

  const handleFormatChange = (newFormat: StandupFormat) => {
    setFormat(newFormat);
    setCustomText(null);
  };

  const toggleItem = (id: string) => {
    setCustomText(null);
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleNotesChange = (key: 'accomplished' | 'workingOn' | 'blockers', val: string) => {
    setCustomText(null);
    setExtraNotes(prev => ({ ...prev, [key]: val }));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = displayText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([displayText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `standup-${data?.dateKey || 'today'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareToChat = () => {
    if (!selectedProjectId) return;
    setShareSuccess(null);
    setShareError(null);

    startSharingTransition(async () => {
      try {
        const res = await fetch('/api/standup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'share',
            projectId: selectedProjectId,
            message: displayText,
          }),
        });
        const result = await res.json();
        if (res.ok && result.success) {
          setShareSuccess(`Shared standup to #${result.projectName} chat!`);
        } else {
          setShareError(result.error || 'Could not post to chat.');
        }
      } catch {
        setShareError('Network error while posting to chat.');
      }
    });
  };

  return (
    <Modal
      title="Daily Standup & Handoff Generator"
      onClose={onClose}
      className="max-w-4xl w-full p-4 sm:p-6"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-3" />
          <p className="text-sm font-medium">Compiling your daily activity & focus...</p>
        </div>
      ) : fetchError ? (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          {fetchError}
        </div>
      ) : !data ? null : (
        <div className="space-y-5">
          {/* Top Bar: Subtitle & Format Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">
                1-click compiled standup for <span className="font-semibold text-gray-900">{data.userName}</span> on {data.date}.
              </p>
            </div>

            {/* Format Switcher */}
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => handleFormatChange('slack')}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  format === 'slack'
                    ? 'bg-surface text-gray-900 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Slack / Discord
              </button>
              <button
                type="button"
                onClick={() => handleFormatChange('markdown')}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  format === 'markdown'
                    ? 'bg-surface text-gray-900 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                GitHub Markdown
              </button>
              <button
                type="button"
                onClick={() => handleFormatChange('text')}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  format === 'text'
                    ? 'bg-surface text-gray-900 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Plain Text
              </button>
            </div>
          </div>

          {/* 2-Column Cockpit */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Checklist & Extra Notes (5 cols) */}
            <div className="lg:col-span-5 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Section 1: Accomplished */}
              <div className="rounded-xl border border-gray-200 p-3 space-y-2 bg-surface">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <span>Yesterday / Accomplished</span>
                  </div>
                  <span className="action-center-pill px-2 py-0.5 text-xs" data-variant="success">
                    {data.accomplished.length}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {data.accomplished.length === 0 ? (
                    <p className="text-gray-400 italic py-1">No tasks completed in last 48h.</p>
                  ) : (
                    data.accomplished.map(item => {
                      const isChecked = !excludedIds.has(item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex items-start gap-2 cursor-pointer rounded-lg p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItem(item.id)}
                            className="mt-0.5 rounded border-gray-300 text-blue-600"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-gray-900 font-medium line-clamp-1">
                              {item.title}
                            </span>
                            <span className="text-gray-500 text-[11px] block truncate">
                              {item.projectName} · {item.type === 'submitted_review' ? 'In review' : 'Completed'}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}

                  <input
                    type="text"
                    value={extraNotes.accomplished}
                    onChange={e => handleNotesChange('accomplished', e.target.value)}
                    placeholder="+ Add other accomplishments..."
                    className="w-full text-xs rounded-md border border-gray-200 px-2.5 py-1.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Section 2: Today's Focus */}
              <div className="rounded-xl border border-gray-200 p-3 space-y-2 bg-surface">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                    <Clock className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    <span>Today&apos;s Focus</span>
                  </div>
                  <span className="action-center-pill px-2 py-0.5 text-xs" data-variant="blue">
                    {data.workingOn.length}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {data.workingOn.length === 0 ? (
                    <p className="text-gray-400 italic py-1">No active tasks assigned.</p>
                  ) : (
                    data.workingOn.map(item => {
                      const isChecked = !excludedIds.has(item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex items-start gap-2 cursor-pointer rounded-lg p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItem(item.id)}
                            className="mt-0.5 rounded border-gray-300 text-blue-600"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-gray-900 font-medium line-clamp-1">
                              {item.title}
                            </span>
                            <span className="text-gray-500 text-[11px] block truncate">
                              {item.projectName} · {item.type === 'in_progress' ? 'In Progress' : 'To Do'}
                              {item.dueDate ? ` · Due ${item.dueDate}` : ''}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}

                  <input
                    type="text"
                    value={extraNotes.workingOn}
                    onChange={e => handleNotesChange('workingOn', e.target.value)}
                    placeholder="+ Add other focus items..."
                    className="w-full text-xs rounded-md border border-gray-200 px-2.5 py-1.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Section 3: Blockers */}
              <div className="rounded-xl border border-gray-200 p-3 space-y-2 bg-surface">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                    <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    <span>Blockers & Needs</span>
                  </div>
                  <span className="action-center-pill px-2 py-0.5 text-xs" data-variant="action">
                    {data.blockers.length}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {data.blockers.length === 0 ? (
                    <p className="text-emerald-700 dark:text-emerald-400 text-xs py-1 font-medium">
                      ✓ No blockers detected!
                    </p>
                  ) : (
                    data.blockers.map(item => {
                      const isChecked = !excludedIds.has(item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex items-start gap-2 cursor-pointer rounded-lg p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItem(item.id)}
                            className="mt-0.5 rounded border-gray-300 text-blue-600"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-gray-900 font-medium line-clamp-1">
                              {item.title}
                            </span>
                            <span className="text-amber-700 dark:text-amber-400 text-[11px] block truncate">
                              {item.detail || item.projectName}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}

                  <input
                    type="text"
                    value={extraNotes.blockers}
                    onChange={e => handleNotesChange('blockers', e.target.value)}
                    placeholder="+ Add custom blocker or impediment..."
                    className="w-full text-xs rounded-md border border-gray-200 px-2.5 py-1.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Live Output & Action Controls (7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
              <div className="relative flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                    <span>Generated Standup Preview</span>
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Editable directly below
                  </span>
                </div>

                <textarea
                  value={displayText}
                  onChange={e => setCustomText(e.target.value)}
                  rows={14}
                  className="w-full flex-1 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 font-mono text-xs text-gray-900 leading-relaxed shadow-inner focus:bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Action Buttons Bar */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Primary CTA: Copy */}
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-white" aria-hidden="true" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" aria-hidden="true" />
                          <span>Copy to Clipboard</span>
                        </>
                      )}
                    </button>

                    {/* Download button */}
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-surface px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                      title="Download as Markdown (.md)"
                    >
                      <Download className="h-4 w-4 text-gray-500" aria-hidden="true" />
                      <span>Download .md</span>
                    </button>
                  </div>

                  {/* Share to Chat */}
                  {data.projects?.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={selectedProjectId}
                        onChange={e => setSelectedProjectId(e.target.value)}
                        className="rounded-lg border border-gray-200 bg-surface px-2.5 py-1.5 text-xs text-gray-800"
                        aria-label="Select project channel"
                      >
                        {data.projects.map(p => (
                          <option key={p.id} value={p.id}>
                            #{p.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={isSharing || !selectedProjectId}
                        onClick={handleShareToChat}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-surface px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:text-blue-600 hover:bg-gray-50 disabled:opacity-50"
                        title="Post standup into project conversation"
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isSharing ? 'Sharing...' : 'Post to Chat'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {shareSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 p-2 text-xs font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{shareSuccess}</span>
                  </div>
                )}
                {shareError && (
                  <div className="flex items-center gap-2 rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 p-2 text-xs font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{shareError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
