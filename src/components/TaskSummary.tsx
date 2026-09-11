import Link from 'next/link';
import { matchesSummary, summaryFilters, type SummaryTask } from '@/lib/task-presentation';
export default function TaskSummary({ tasks, today }: { tasks: SummaryTask[]; today: string }) {
  return <section aria-label="Task summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
    {summaryFilters.map(filter => <Link key={filter.id} href={`/dashboard/tasks?summary=${filter.id}`} data-summary={filter.id} className="summary-card rounded-xl border border-gray-200 bg-surface p-5 hover:border-blue-400 transition">
      <p className="text-sm text-gray-600">{filter.label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{tasks.filter(task => matchesSummary(task, filter.id, today)).length}</p>
      <p className="mt-2 text-xs text-gray-500">View tasks →</p>
    </Link>)}
  </section>;
}
