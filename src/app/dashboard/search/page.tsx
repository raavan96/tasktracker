import WorkspaceHeading from '@/components/WorkspaceHeading';
import Link from 'next/link';
import { searchWorkspace } from '@/lib/workspace-data';

const KIND_LABELS: Record<string, string> = {
  Project: 'Project',
  Task: 'Task',
  'Project note': 'Project note',
  'Task remark': 'Task remark',
};

function HighlightedExcerpt({ text, query }: { text: string; query?: string }) {
  if (!text) return null;

  // Render text containing [[HL]]...[[/HL]] markers from PostgreSQL ts_headline
  if (text.includes('[[HL]]')) {
    const parts = text.split(/(\[\[HL\]\].*?\[\[\/HL\]\])/g);
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('[[HL]]') && part.endsWith('[[/HL]]')) {
            return (
              <mark
                key={i}
                className="search-highlight"
              >
                {part.slice(6, -7)}
              </mark>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  }

  // Fallback: highlight search query words if text has no ts_headline markers
  if (query && query.trim()) {
    const words = query
      .trim()
      .split(/\s+/)
      .map(w => w.replace(/[^\w-]/g, ''))
      .filter(w => w.length > 0);
    if (words.length > 0) {
      const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
      const parts = text.split(regex);
      return (
        <>
          {parts.map((part, i) =>
            regex.test(part) ? (
              <mark
                key={i}
                className="search-highlight"
              >
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </>
      );
    }
  }

  return <>{text}</>;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string; page?: string }>;
}) {
  const p = await searchParams;
  const q = p.q || '';
  const result = await searchWorkspace(q, p.archived === 'true', Number(p.page));
  const href = (page: number) =>
    '/dashboard/search?' + new URLSearchParams({ q, archived: p.archived || 'false', page: String(page) });

  return (
    <div className="space-y-5">
      <div>
        <WorkspaceHeading className="text-2xl font-bold">Search workspace</WorkspaceHeading>
        <p className="text-sm text-gray-500">Find words in accessible projects, tasks, notes and remarks.</p>
      </div>

      <form method="get" className="flex flex-wrap gap-3">
        <input
          name="q"
          aria-label="Search workspace"
          defaultValue={q}
          maxLength={200}
          placeholder="Search words or a phrase…"
          className="min-w-0 flex-1 rounded-lg border bg-surface p-3"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" name="archived" value="true" defaultChecked={p.archived === 'true'} />
          Include archived
        </label>
        <button className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700">
          Search
        </button>
      </form>

      {q && (
        <p role="status" className="text-sm text-gray-600">
          {result.total} results
        </p>
      )}

      <div className="space-y-3">
        {result.items.map(r => (
          <Link
            key={r.kind + r.id}
            href={r.url}
            className="block rounded-xl border bg-surface p-4 transition-colors hover:border-blue-400/50 hover:bg-gray-50/50"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="kind-chip" data-kind={r.kind}>
                {KIND_LABELS[r.kind] || r.kind}
              </span>
              {r.archived && (
                <span className="kind-chip" data-kind="Archived">
                  Archived
                </span>
              )}
              {r.kind !== 'Project' && (
                <span className="text-gray-500">
                  in <strong className="font-medium text-gray-700">{r.project_name}</strong>
                </span>
              )}
            </div>

            <h2 className="mt-1.5 font-semibold text-gray-900">
              <HighlightedExcerpt text={r.title} query={q} />
            </h2>

            {r.body && (
              <p className="mt-2 break-words text-sm text-gray-600">
                <HighlightedExcerpt text={r.body} query={q} />
              </p>
            )}
          </Link>
        ))}
      </div>

      {q && !result.total && <p className="p-8 text-center text-gray-500">No accessible results match these words.</p>}

      {result.total > 25 && (
        <nav aria-label="Search pages" className="flex items-center gap-4 text-sm text-gray-600">
          {result.page > 1 && (
            <Link href={href(result.page - 1)} className="text-blue-600 underline">
              Previous
            </Link>
          )}
          <span>
            Page {result.page} of {Math.ceil(result.total / 25)}
          </span>
          {result.page * 25 < result.total && (
            <Link href={href(result.page + 1)} className="text-blue-600 underline">
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
